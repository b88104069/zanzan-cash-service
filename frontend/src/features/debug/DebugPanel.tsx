import { useEffect, useState } from 'react';
import { readRawStorageForDebug, STORAGE_KEY } from '../../localdb/persistence';

/**
 * Gate 5 (ACTIVE) scope item 13: a clearly labeled section that DISPLAYS
 * what's actually in browser storage, so a tester can confirm an on-screen
 * action really persisted. This panel does not itself persist anything —
 * localStorage (via src/localdb/persistence.ts) is the real store; this is
 * read-only and has no effect on normal bookkeeping operations.
 */
export function DebugPanel({ refreshKey }: { refreshKey: number }) {
  const [raw, setRaw] = useState('');

  useEffect(() => {
    const data = readRawStorageForDebug();
    setRaw(JSON.stringify(data, null, 2));
  }, [refreshKey]);

  return (
    <section id="sec-debug" className="panel debug-panel">
      <h3>Prototype Data / Debug</h3>
      <p className="debug-note">
        這個區塊只「顯示」瀏覽器 <code>localStorage</code>（key: <code>{STORAGE_KEY}</code>）目前實際儲存的內容，用來確認畫面上的操作是否真的有寫入資料。真正負責保存資料的是
        localStorage 本身，不是這個區塊——重新整理頁面或關閉分頁重開，資料仍會在。這裡不影響正式記帳操作。
      </p>
      <textarea readOnly value={raw} rows={16} className="debug-textarea" spellCheck={false} />
    </section>
  );
}
