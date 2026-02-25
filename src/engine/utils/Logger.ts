import { EventBus } from './EventBus';

export type LogClass = 'normal' | 'action' | 'enemy' | 'skill' | 'heal' | 'critical' | 'system';

const CLASS_MAP: Record<LogClass, string> = {
  normal:   'le',
  action:   'la',
  enemy:    'lae',
  skill:    'lsk',
  heal:     'lh',
  critical: 'lc',
  system:   'ls',
};

export const Logger = {
  log(text: string, type: LogClass = 'normal'): void {
    console.log(`%c[${type.toUpperCase()}] ${text}`, 'color: #c9a84c');
    EventBus.emit('logMessage', { text, cls: CLASS_MAP[type] });
  },
};
