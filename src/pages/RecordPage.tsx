import { useEffect, useState } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Star } from 'lucide-react';
import { Navbar } from '@/components';
import { useLogStore } from '@/stores/logStore';
import styles from './RecordPage.module.css';

export function RecordPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const { logs, fetchLogs, loading } = useLogStore();

  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  useEffect(() => {
    fetchLogs(dateStr);
  }, [dateStr, fetchLogs]);

  return (
    <div className={styles.page}>
      <Navbar title="饮酒记录" subtitle="JOURNAL" showNotifications={false} />

      <div className={styles.content}>
        {/* 日历组件 */}
        <div className={styles.calendarCard}>
          <Calendar 
            onChange={(val) => setSelectedDate(val as Date)} 
            value={selectedDate}
            className={styles.calendar}
            locale="zh-CN"
            next2Label={null}
            prev2Label={null}
          />
        </div>

        {/* 记录列表 */}
        <div className={styles.recordsSection}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>
              <CalendarIcon size={18} />
              {format(selectedDate, 'M月d日')} 记录
            </h2>
          </div>

          {loading ? (
            <div className={styles.empty}>加载中...</div>
          ) : logs.length > 0 ? (
            <div className={styles.logList}>
              {logs.map((log) => (
                <div key={log.id} className={styles.logCard}>
                  {log.recipe?.image_url ? (
                    <img src={log.recipe.image_url} alt="drink" className={styles.logImg} />
                  ) : (
                    <div className={styles.logPlaceholder}>🍸</div>
                  )}
                  <div className={styles.logInfo}>
                    <div className={styles.logName}>{log.recipe?.name_zh || '未知酒款'}</div>
                    {log.rating && (
                      <div className={styles.logRating}>
                        <Star size={12} fill="#F5A623" color="#F5A623" />
                        {log.rating}
                      </div>
                    )}
                    {log.notes && <div className={styles.logNotes}>{log.notes}</div>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.empty}>
              <span className={styles.emptyEmoji}>🥂</span>
              <div className={styles.emptyTitle}>今天还没喝呢</div>
              <div className={styles.emptySub}>记录下今天的微醺时刻吧</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
