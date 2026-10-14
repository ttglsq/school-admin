import { useState, useEffect, useMemo, useCallback } from 'react';
import { ScrollText, RefreshCw, Download, Trash2, Search, CloudOff, Cloud, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  type OperationLog, type LogAction, ACTION_LABELS, ENTITY_LABELS, RESULT_LABELS,
  fetchCloudLogs, getLocalLogs, clearLocalLogs, mergeLogs, onLogChange,
} from '@/lib/opLog';

const ACTION_STYLE: Record<LogAction, string> = {
  add: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  update: 'bg-blue-100 text-blue-700 border-blue-200',
  delete: 'bg-red-100 text-red-700 border-red-200',
  save: 'bg-violet-100 text-violet-700 border-violet-200',
  error: 'bg-orange-100 text-orange-700 border-orange-200',
  sync: 'bg-slate-100 text-slate-700 border-slate-200',
};

function fmtTime(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

export default function OperationLogPage() {
  const [cloudLogs, setCloudLogs] = useState<OperationLog[]>([]);
  const [localLogs, setLocalLogs] = useState<OperationLog[]>(() => getLocalLogs());
  const [loading, setLoading] = useState(true);
  const [cloudOk, setCloudOk] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [actionFilter, setActionFilter] = useState<'all' | LogAction>('all');
  const [onlyProblems, setOnlyProblems] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const list = await fetchCloudLogs(500);
    setCloudLogs(list);
    setCloudOk(list.length > 0);
    setLocalLogs(getLocalLogs());
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  // 本机新增日志时自动刷新（不用手动点）
  useEffect(() => {
    const unsub = onLogChange(() => setLocalLogs(getLocalLogs()));
    return () => { unsub(); };
  }, []);

  const merged = useMemo(() => mergeLogs(cloudLogs, localLogs), [cloudLogs, localLogs]);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return merged.filter(l => {
      if (actionFilter !== 'all' && l.action !== actionFilter) return false;
      if (onlyProblems && l.result !== 'failed' && l.result !== 'queued' && l.action !== 'error') return false;
      if (!kw) return true;
      return [l.actor, l.target, l.detail, ENTITY_LABELS[l.entity], ACTION_LABELS[l.action]]
        .filter(Boolean).join(' ').toLowerCase().includes(kw);
    });
  }, [merged, keyword, actionFilter, onlyProblems]);

  const problemCount = useMemo(
    () => merged.filter(l => l.result === 'failed' || l.result === 'queued' || l.action === 'error').length,
    [merged],
  );

  const exportCsv = () => {
    const header = ['时间', '操作人', '操作', '模块', '对象', '详情', '云端结果'];
    const rows = filtered.map(l => [
      fmtTime(l.ts), l.actor, ACTION_LABELS[l.action], ENTITY_LABELS[l.entity],
      l.target || '', l.detail || '', l.result ? RESULT_LABELS[l.result] : '—',
    ]);
    const csv = [header, ...rows]
      .map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    // 加 BOM，Excel 打开中文不乱码
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `操作日志_${fmtTime(new Date().toISOString()).replace(/[: ]/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`已导出 ${filtered.length} 条日志`);
  };

  return (
    <div className="space-y-4">
      {/* 顶部说明 + 操作 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 font-medium">
                <ScrollText className="w-5 h-5 text-blue-600" />
                操作日志
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                记录每一次新增／修改／删除／保存，以及是否成功写入云端。
                {cloudOk ? '云端日志已加载。' : '云端日志暂不可达，以下显示本机记录。'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => void refresh()} disabled={loading} className="gap-1.5">
                <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} /> 刷新
              </Button>
              <Button variant="outline" size="sm" onClick={exportCsv} disabled={filtered.length === 0} className="gap-1.5">
                <Download className="w-4 h-4" /> 导出 CSV
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-muted-foreground"
                onClick={() => {
                  if (window.confirm('确定清空本机日志缓存吗？（云端日志不受影响，下次刷新会重新拉取）')) {
                    clearLocalLogs();
                    setLocalLogs([]);
                    toast.success('已清空本机日志');
                  }
                }}
              >
                <Trash2 className="w-4 h-4" /> 清空本机
              </Button>
            </div>
          </div>

          {/* 统计条 */}
          <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="w-3.5 h-3.5" /> 共 {merged.length} 条
            </span>
            {problemCount > 0 ? (
              <span className="flex items-center gap-1.5 text-orange-600 font-medium">
                <CloudOff className="w-3.5 h-3.5" /> {problemCount} 条异常／待补传
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-emerald-600">
                <Cloud className="w-3.5 h-3.5" /> 无异常
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 筛选 */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="搜索对象、操作人、内容…"
              className="pl-9 w-64"
            />
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {(['all', 'add', 'update', 'delete', 'save', 'sync', 'error'] as const).map(a => (
              <button
                key={a}
                onClick={() => setActionFilter(a)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
                  actionFilter === a
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-background border-input hover:bg-muted',
                )}
              >
                {a === 'all' ? '全部' : ACTION_LABELS[a]}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none ml-auto">
            <input
              type="checkbox"
              checked={onlyProblems}
              onChange={e => setOnlyProblems(e.target.checked)}
              className="w-4 h-4 accent-orange-600"
            />
            只看异常／待补传
          </label>
        </CardContent>
      </Card>

      {/* 日志表 */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-44">时间</TableHead>
                <TableHead className="w-24">操作人</TableHead>
                <TableHead className="w-20">操作</TableHead>
                <TableHead className="w-24">模块</TableHead>
                <TableHead className="min-w-52">对象</TableHead>
                <TableHead className="min-w-64">详情</TableHead>
                <TableHead className="w-28">云端</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(l => (
                <TableRow key={l.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{fmtTime(l.ts)}</TableCell>
                  <TableCell className="text-xs">{l.actor}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={cn('text-xs', ACTION_STYLE[l.action])}>
                      {ACTION_LABELS[l.action]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{ENTITY_LABELS[l.entity]}</TableCell>
                  <TableCell className="text-sm font-medium">{l.target || '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{l.detail || '—'}</TableCell>
                  <TableCell className="text-xs">
                    {l.result === 'ok' && <span className="text-emerald-600">已写入</span>}
                    {l.result === 'queued' && <span className="text-orange-600 font-medium">待补传</span>}
                    {l.result === 'failed' && <span className="text-red-600 font-medium">失败</span>}
                    {!l.result && <span className="text-muted-foreground">—</span>}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                    {loading ? '正在加载日志…' : merged.length === 0 ? '暂无操作日志' : '没有符合筛选条件的记录'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground px-1">
        本机日志最多保留最近 800 条；云端日志供多设备排查用。只读页面，不会修改任何业务数据。
      </p>
    </div>
  );
}
