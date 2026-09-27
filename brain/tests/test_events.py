import importlib.util
import json
import io
import contextlib
import threading
import time
import urllib.request
import urllib.error
import argparse
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('brain', Path(__file__).parents[1] / 'brain.py')
b = importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)

class EventsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = Path(self.tmp.name)
        self.patches = [patch.object(b, key, root / value) for key, value in
                        [('DATA','brain.json'), ('HISTORY','history'), ('EVENTS','events.jsonl')]]
        for p in self.patches: p.start()
        b._pending_events.items = []
    def tearDown(self):
        for p in self.patches: p.stop()
        self.tmp.cleanup()
    def records(self):
        return [json.loads(s) for s in b.EVENTS.read_text().splitlines()]
    def test_save_note_and_mcp(self):
        doc = b.load()
        node = b.add_note(doc, 'event test')
        b.save(doc)
        events = self.records()
        self.assertIn('note', [e['kind'] for e in events])
        self.assertIn(node['id'], next(e['ids'] for e in events if e['kind']=='note'))
        b.mcp_call('brain_get', {'id':node['id']})
        event = self.records()[-1]
        self.assertEqual(event['source'], 'mcp:brain_get')
        self.assertIn(node['id'], event['ids'])
        node['summary'] = 'updated'
        b.save(doc)
        self.assertIn('node_updated', [e['kind'] for e in self.records()])
        b.add_edge(doc, node['id'], 'supports', 'inbox')
        b.save(doc)
        self.assertIn('link_added', [e['kind'] for e in self.records()])
    def test_dry_ingest_does_not_complete(self):
        path = Path(self.tmp.name)/'input.txt'
        path.write_text('hello')
        with patch.object(b, 'extract', return_value={'nodes':[], 'edges':[]}):
            b.ingest_path(b.load(), path, 'ollama', None, dry=True, log=lambda _:None)
        self.assertEqual([e['kind'] for e in self.records()], ['ingest_start'])
    def test_pending_event_after_save(self):
        doc=b.load()
        b.save(doc)
        b._pending_events.items=[{'kind':'ingest_done','ids':[],'source':'test'}]
        b.save(doc)
        self.assertEqual(self.records()[-1]['kind'], 'ingest_done')
    def test_log_failure_does_not_break_save(self):
        b.EVENTS = Path(self.tmp.name)/'absent'/'events.jsonl'
        b.save(b.load())
        self.assertTrue(b.DATA.exists())

class IntegrationTest(unittest.TestCase):
    setUp = EventsTest.setUp
    tearDown = EventsTest.tearDown
    records = EventsTest.records
    def test_watcher_emits_arrival_and_committed_ingest(self):
        inbox = Path(self.tmp.name) / 'inbox'
        inbox.mkdir()
        file = inbox / 'capture.txt'
        file.write_text('fixture facts')
        os.utime(file, (time.time() - 10, time.time() - 10))
        stop = threading.Event()
        doc = b.load()
        b.add_note(doc, 'Fixture')
        b.save(doc)
        def extract(*args):
            stop.set()
            return {'nodes': [{'id': 'captured', 'title': 'Captured', 'type': 'note', 'summary': 'Fact'}], 'edges': []}
        with patch.object(b, 'INBOX', inbox), patch.object(b, 'DONE', inbox / 'done'), patch.object(b, 'extract', side_effect=extract):
            b.watch_inbox(.01, 'ollama', None, log=lambda _: None, stop=stop)
        self.assertTrue((inbox / 'done' / 'capture.txt').exists())
        events = self.records()
        self.assertTrue(any(e['kind'] == 'note' and e['source'] == 'watcher:capture.txt' for e in events))
        self.assertTrue(any(e['kind'] == 'ingest_done' and 'captured' in e['ids'] for e in events))
    def test_sort_records_destinations(self):
        doc=b.load(); note=b.add_note(doc, 'sort me'); b.save(doc)
        proposal={'nodes':[{'id':'sorted-node','type':'note','title':'Sorted node','summary':'Sorted','confidence':'high'}], 'edges':[]}
        args=argparse.Namespace(local=None,model=None,dry_run=False,keep=False)
        with patch.object(b,'extract',return_value=proposal),contextlib.redirect_stdout(io.StringIO()):
            b.cmd_sort(args)
        event=next(e for e in reversed(self.records()) if e['kind']=='sort')
        self.assertIn('sorted-node',event['ids'])
        self.assertNotIn(note['id'],event['ids'])
    def test_cli_commands_keep_working(self):
        doc=b.load(); b.add_note(doc,'Fixture'); b.save(doc)
        with contextlib.redirect_stdout(io.StringIO()):
            for args in [['tree'],['find','Fixture'],['show','fixture'],['types'],['rels'],['tags'],['stats'],['validate'],['export'],['export','--json'],['history'],['context']]:
                b.main(args)
            b.main(['add','--type','note','--parent','inbox','--title','Second fixture','--summary','A note'])
            b.main(['edit','second-fixture','--conf','low'])
            b.main(['link','fixture','supports','second-fixture'])
            b.main(['unlink','fixture','second-fixture'])
            b.main(['mv','second-fixture','root'])
            b.main(['rm','second-fixture'])
        self.assertEqual(b.validate(b.load()),[])
    def test_http_static_conflicts_and_sse_resume(self):
        doc=b.load(); b.add_note(doc,'Fixture'); rev=b.save(doc)
        root=Path(self.tmp.name)/'dist';root.mkdir();(root/'index.html').write_text('town fixture');(root/'app.js').write_text('const ok=true;')
        with patch.object(b,'TOWN',root):
            server=b.ThreadingHTTPServer(('127.0.0.1',0),b.Handler)
            server.stop_event=threading.Event()
            threading.Thread(target=server.serve_forever,daemon=True).start()
            url=f'http://127.0.0.1:{server.server_port}'
            try:
                with urllib.request.urlopen(url+'/town/') as response:self.assertEqual(response.read(),b'town fixture')
                with urllib.request.urlopen(url+'/town/app.js') as response:self.assertEqual(response.headers['Content-Type'],'text/javascript')
                for path in ['/town/../brain.json','/town/%2e%2e/brain.json']:
                    with self.assertRaises(urllib.error.HTTPError) as error:urllib.request.urlopen(url+path)
                    self.assertEqual(error.exception.code,403)
                request=urllib.request.Request(url+'/api/brain',data=json.dumps({'doc':doc,'baseRev':'stale'}).encode(),method='PUT')
                with self.assertRaises(urllib.error.HTTPError) as error:urllib.request.urlopen(request)
                self.assertEqual(error.exception.code,409)
                offset=b.EVENTS.stat().st_size
                b.emit_event('note',['fixture'],source='test')
                request=urllib.request.Request(url+'/api/events',headers={'Last-Event-ID':str(offset)})
                with urllib.request.urlopen(request,timeout=3) as response:
                    while True:
                        line=response.readline()
                        if line.startswith(b'data: '):
                            self.assertEqual(json.loads(line[6:])['ids'],['fixture']);break
            finally:
                server.stop_event.set();server.shutdown();server.server_close();time.sleep(.2)
    def test_http_conditional_get_is_not_a_read(self):
        doc=b.load(); b.add_note(doc,'Fixture'); b.save(doc)
        server=b.ThreadingHTTPServer(('127.0.0.1',0),b.Handler)
        server.stop_event=threading.Event()
        threading.Thread(target=server.serve_forever,daemon=True).start()
        url=f'http://127.0.0.1:{server.server_port}/api/brain'
        reads=lambda:[r for r in self.records() if r['kind']=='mcp_read' and r['source']=='http:brain']
        try:
            before=len(reads())
            with urllib.request.urlopen(url) as response:
                rev=response.headers['ETag'];self.assertEqual(json.loads(response.read())['rev'],rev)
            self.assertEqual(len(reads()),before+1)
            request=urllib.request.Request(url,headers={'If-None-Match':rev})
            with self.assertRaises(urllib.error.HTTPError) as error:urllib.request.urlopen(request)
            self.assertEqual(error.exception.code,304)
            self.assertEqual(error.exception.headers['ETag'],rev)
            self.assertEqual(len(reads()),before+1)
            request=urllib.request.Request(url,headers={'If-None-Match':'stale'})
            with urllib.request.urlopen(request) as response:self.assertEqual(response.status,200)
            self.assertEqual(len(reads()),before+2)
        finally:
            server.stop_event.set();server.shutdown();server.server_close();time.sleep(.2)

if __name__ == '__main__': unittest.main()

