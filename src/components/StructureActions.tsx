import { useState } from 'react';
import { useI18n } from '../i18n';
import { clearLowestOne, lowestOne, setBitsValue, shiftBits, type BitsList } from '../lib/bits';
import * as m from '../lib/model';
import { canInsert, cleanWord, setTrieAt, trieInsert, trieNodes, trieRemove, trieSearchSteps, type Trie } from '../lib/trie';
import {
  addUfNode,
  canRemoveUfNode,
  removeUfNode,
  resetUnionFind,
  setUnionByRank,
  UF_MAX,
  ufFind,
  ufRoot,
  ufUnion,
  type UnionFind,
} from '../lib/unionFind';
import { useNotice } from './Notice';

// 位元列、並查集、字典樹在選取列上的操作（Whiteboard.tsx 已經很長，新的元件放這裡）。

type Apply = (doc: m.BoardDoc) => void;

/** 一連串的步驟：勾了「記成逐步播放」就每一步都記，沒勾就直接跳到最後 */
function runSteps(doc: m.BoardDoc, steps: m.HeapStep[], record: boolean, apply: Apply) {
  if (steps.length === 0) return;
  apply(record ? m.recordHeapSteps(doc, steps) : steps[steps.length - 1].doc);
}

function RecordToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="board-heap-record">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

/** 位元列：左移、右移、清掉最低位的 1、直接改數字 */
export function BitsActions({ el, doc, apply }: { el: BitsList; doc: m.BoardDoc; apply: Apply }) {
  const { t } = useI18n();
  const b = t.board.bits;
  const [value, setValue] = useState('');
  return (
    <>
      <button type="button" className="btn btn-small" onClick={() => apply(shiftBits(doc, el.id, 'left'))}>
        {b.shiftLeft}
      </button>
      <button type="button" className="btn btn-small" onClick={() => apply(shiftBits(doc, el.id, 'right'))}>
        {b.shiftRight}
      </button>
      <button type="button" className="btn btn-small" title={b.clearLowestHint} disabled={lowestOne(el) < 0} onClick={() => apply(clearLowestOne(doc, el.id))}>
        {b.clearLowest}
      </button>
      <form
        className="board-heap-push"
        onSubmit={(e) => {
          e.preventDefault();
          if (!/^\d+$/.test(value.trim())) return;
          apply(setBitsValue(doc, el.id, Number(value.trim())));
          setValue('');
        }}
      >
        <input
          className="input board-weight"
          value={value}
          inputMode="numeric"
          aria-label={b.setValue}
          placeholder={b.setValue}
          maxLength={10}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
        />
        <button type="submit" className="btn btn-small" disabled={!/^\d+$/.test(value.trim())}>
          {t.board.actions.applyText}
        </button>
      </form>
    </>
  );
}

/** 並查集整體：union by rank 開關、加減節點、全部分開 */
export function UnionFindActions({ el, doc, apply }: { el: UnionFind; doc: m.BoardDoc; apply: Apply }) {
  const { t } = useI18n();
  const u = t.board.unionFind;
  const full = el.parent.length >= UF_MAX;
  return (
    <>
      <button type="button" className="btn btn-small" aria-pressed={!!el.rank} onClick={() => apply(setUnionByRank(doc, el.id, !el.rank))}>
        {el.rank ? u.byRankOff : u.byRankOn}
      </button>
      <button type="button" className="btn btn-small" disabled={full} title={full ? u.full : undefined} onClick={() => apply(addUfNode(doc, el.id))}>
        {u.addNode}
      </button>
      <button type="button" className="btn btn-small" disabled={!canRemoveUfNode(el)} onClick={() => apply(removeUfNode(doc, el.id))}>
        {u.removeNode}
      </button>
      <button type="button" className="btn btn-small" onClick={() => apply(resetUnionFind(doc, el.id))}>
        {u.reset}
      </button>
    </>
  );
}

/** 並查集選了一個節點：Find（順便路徑壓縮）、和另一個節點 Union */
export function UnionFindNodeActions({ el, index, doc, apply }: { el: UnionFind; index: number; doc: m.BoardDoc; apply: Apply }) {
  const { t } = useI18n();
  const u = t.board.unionFind;
  const toast = useNotice();
  const [record, setRecord] = useState(false);
  const others = el.parent.map((_, i) => i).filter((i) => i !== index);
  return (
    <>
      <span className="board-selbar-title">{u.node(index, ufRoot(el.parent, index))}</span>
      <button type="button" className="btn btn-small" onClick={() => runSteps(doc, ufFind(doc, el.id, index)?.steps ?? [], record, apply)}>
        {u.find(index)}
      </button>
      {others.length > 0 && (
        <select
          className="select board-connect"
          aria-label={u.unionWith(index)}
          value=""
          onChange={(e) => {
            if (e.target.value === '') return;
            const other = Number(e.target.value);
            if (ufRoot(el.parent, index) === ufRoot(el.parent, other)) toast(u.sameSet(index, other));
            runSteps(doc, ufUnion(doc, el.id, index, other), record, apply);
          }}
        >
          <option value="">{u.unionWith(index)}</option>
          {others.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </select>
      )}
      <RecordToggle label={u.record} checked={record} onChange={setRecord} />
    </>
  );
}

/** 字典樹整體：輸入一個字，Insert 或 Search；可以把每一步記成逐步播放 */
export function TrieActions({ el, doc, apply }: { el: Trie; doc: m.BoardDoc; apply: Apply }) {
  const { t } = useI18n();
  const r = t.board.trie;
  const toast = useNotice();
  const [word, setWord] = useState('');
  const [record, setRecord] = useState(false);
  const clean = cleanWord(word);
  return (
    <>
      <form
        className="board-heap-push"
        onSubmit={(e) => {
          e.preventDefault();
          if (!clean) return;
          if (!canInsert(el, clean)) {
            toast(r.full);
            return;
          }
          runSteps(doc, trieInsert(doc, el.id, clean), record, apply);
          setWord('');
        }}
      >
        <input
          className="input board-weight"
          value={word}
          aria-label={r.word}
          placeholder={r.word}
          maxLength={16}
          autoCapitalize="off"
          spellCheck={false}
          onChange={(e) => setWord(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
        />
        <button type="submit" className="btn btn-small" disabled={!clean}>
          {r.insert}
        </button>
        <button type="button" className="btn btn-small" disabled={!clean} onClick={() => runSteps(doc, trieSearchSteps(doc, el.id, clean), record, apply)}>
          {r.search}
        </button>
      </form>
      {el.at !== undefined && (
        <button type="button" className="btn btn-small" onClick={() => apply(setTrieAt(doc, el.id, undefined))}>
          {r.clear}
        </button>
      )}
      <RecordToggle label={r.record} checked={record} onChange={setRecord} />
    </>
  );
}

/** 字典樹選了一個節點：找這個前綴；有字在這裡結束的話可以拿掉它 */
export function TrieNodeActions({ el, index, doc, apply }: { el: Trie; index: number; doc: m.BoardDoc; apply: Apply }) {
  const { t } = useI18n();
  const r = t.board.trie;
  const node = trieNodes(el.words).nodes[index];
  if (!node) return null;
  return (
    <>
      <span className="board-selbar-title">{r.node(node.prefix)}</span>
      {index > 0 && (
        <button type="button" className="btn btn-small" onClick={() => apply(setTrieAt(doc, el.id, node.prefix))}>
          {r.searchPrefix}
        </button>
      )}
      {node.end && (
        <button type="button" className="btn btn-small btn-danger" onClick={() => apply(trieRemove(doc, el.id, node.prefix))}>
          {r.removeWord(node.prefix)}
        </button>
      )}
    </>
  );
}
