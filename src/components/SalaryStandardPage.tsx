import { useState } from 'react';
import { Coins, RotateCcw, Info, MousePointerClick } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { SalaryStandardData, SalaryCoefficientKey, SalaryStandardRow } from '@/types';
import { SALARY_LEVELS } from '@/types';
import { cn } from '@/lib/utils';

interface SalaryStandardPageProps {
  data: SalaryStandardData;
  onUpdate: (key: SalaryCoefficientKey, rows: SalaryStandardRow[]) => void;
  onReset: (key: SalaryCoefficientKey) => void;
}

// 等级 tab 配色（与老师等级一致）
const LEVEL_TAB_COLORS: Record<SalaryCoefficientKey, string> = {
  '0.38': 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200',
  '0.35': 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200',
  '0.3': 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200',
};

const LEVEL_TAB_ACTIVE: Record<SalaryCoefficientKey, string> = {
  '0.38': 'border-red-400 bg-red-500 text-white shadow-sm shadow-red-200',
  '0.35': 'border-amber-400 bg-amber-500 text-white shadow-sm shadow-amber-200',
  '0.3': 'border-green-400 bg-green-500 text-white shadow-sm shadow-green-200',
};

interface EditingCell {
  key: SalaryCoefficientKey;
  index: number;
  field: 'x' | 'y';
}

export default function SalaryStandardPage({ data, onUpdate, onReset }: SalaryStandardPageProps) {
  const [activeKey, setActiveKey] = useState<SalaryCoefficientKey>('0.38');
  const [editing, setEditing] = useState<EditingCell | null>(null);
  const [draft, setDraft] = useState('');
  const [resetKey, setResetKey] = useState<SalaryCoefficientKey | null>(null);

  const activeLevel = SALARY_LEVELS.find(l => l.key === activeKey)!;
  const rows = data[activeKey];

  const startEdit = (index: number, field: 'x' | 'y') => {
    const value = rows[index][field];
    setEditing({ key: activeKey, index, field });
    setDraft(String(value));
  };

  const commitEdit = () => {
    if (!editing) return;
    const { key, index, field } = editing;
    const parsed = Number(draft.trim());
    // 数值校验：x 必须为非负数字；y 必须为非负数字（允许小数）
    if (draft.trim() === '' || Number.isNaN(parsed) || parsed < 0) {
      toast.error('请输入有效的非负数字');
      setEditing(null);
      return;
    }
    const next = data[key].map((r, i) => (i === index ? { ...r, [field]: parsed } : r));
    onUpdate(key, next);
    setEditing(null);
  };

  const commitOnKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEdit();
    } else if (e.key === 'Escape') {
      setEditing(null);
    }
  };

  const handleReset = () => {
    if (!resetKey) return;
    onReset(resetKey);
    setResetKey(null);
    toast.success(`已恢复 ${SALARY_LEVELS.find(l => l.key === resetKey)?.levelLabel}（${resetKey} 系数）为初始值`);
  };

  const renderCell = (index: number, field: 'x' | 'y', value: number) => {
    const isEditing = editing?.key === activeKey && editing.index === index && editing.field === field;
    if (isEditing) {
      return (
        <input
          autoFocus
          type="number"
          step="any"
          min="0"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={commitOnKey}
          className="w-28 h-8 px-2 rounded-md border-2 border-blue-400 bg-blue-50/50 text-sm outline-none focus:ring-2 focus:ring-blue-200"
        />
      );
    }
    return (
      <button
        onClick={() => startEdit(index, field)}
        title="点击编辑"
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-blue-50 hover:text-blue-700 hover:shadow-sm transition-all cursor-pointer font-mono tabular-nums"
      >
        {field === 'x' ? Math.round(value * 10) / 10 : value.toFixed(2)}
        <MousePointerClick className="w-3 h-3 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    );
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* 说明卡片 */}
      <Card className="border-blue-200 bg-blue-50/60">
        <CardContent className="p-4 flex items-start gap-3">
          <Coins className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
          <div className="text-sm text-blue-900/80 space-y-0.5">
            <p className="font-medium text-blue-900">听力系数</p>
            <p className="text-xs text-blue-700/70 mt-1">等级对应系数：A级（高级）= 0.38 ｜ B级（中级）= 0.35 ｜ C级（初级）= 0.3</p>
          </div>
        </CardContent>
      </Card>

      {/* 等级切换 */}
      <div className="flex flex-wrap gap-3">
        {SALARY_LEVELS.map(level => (
          <button
            key={level.key}
            onClick={() => setActiveKey(level.key)}
            className={cn(
              'flex items-center gap-2.5 px-4 py-2.5 rounded-xl border-2 font-medium transition-all duration-150',
              activeKey === level.key ? LEVEL_TAB_ACTIVE[level.key] : cn('bg-card', LEVEL_TAB_COLORS[level.key])
            )}
          >
            <span className="text-base">{level.levelLabel}</span>
            <span className={cn('text-xs opacity-80', activeKey === level.key && 'opacity-90')}>{level.levelDesc}</span>
            <Badge
              variant="outline"
              className={cn(
                'font-mono text-xs',
                activeKey === level.key
                  ? 'border-white/40 bg-white/15 text-white'
                  : cn('border-transparent', LEVEL_TAB_COLORS[level.key])
              )}
            >
              系数 {level.coefficient}
            </Badge>
          </button>
        ))}
      </div>

      {/* 表格卡片 */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Info className="w-4 h-4" />
            当前查看：{activeLevel.levelLabel}（{activeLevel.levelDesc}）· 系数 {activeLevel.coefficient} · 共 {rows.length} 个档位
          </div>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-amber-700 border-amber-200 hover:bg-amber-50"
            onClick={() => setResetKey(activeKey)}
          >
            <RotateCcw className="w-4 h-4" /> 恢复默认
          </Button>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-14 text-center">#</TableHead>
                <TableHead className="w-44">x 分钟/周</TableHead>
                <TableHead>y 元/周/人</TableHead>
                <TableHead className="text-xs text-muted-foreground font-normal">说明</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={index} className={cn('group table-row-hover', index % 2 === 1 && 'bg-muted/20')}>
                  <TableCell className="text-center text-muted-foreground">{index + 1}</TableCell>
                  <TableCell className="whitespace-nowrap">{renderCell(index, 'x', row.x)}</TableCell>
                  <TableCell className="whitespace-nowrap">{renderCell(index, 'y', row.y)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground/70">
                    {row.x} 分钟/周 · 人均 {row.y.toFixed(2)} 元/周
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="px-4 py-3 border-t bg-muted/20 text-xs text-muted-foreground flex items-center gap-1.5">
          <MousePointerClick className="w-3.5 h-3.5" />
          点击表格中的数值即可编辑，Enter 或点击空白处保存，Esc 取消
        </div>
      </Card>

      {/* 恢复默认确认 */}
      <AlertDialog open={resetKey !== null} onOpenChange={(open) => !open && setResetKey(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认恢复默认数据？</AlertDialogTitle>
            <AlertDialogDescription>
              将把 {SALARY_LEVELS.find(l => l.key === resetKey)?.levelLabel}（{resetKey} 系数）的 {rows.length} 个档位数据恢复为初始值，当前修改将被覆盖。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleReset}>确认恢复</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
