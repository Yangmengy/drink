import { useEffect, useState, useMemo } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { format } from 'date-fns';
import { Calendar as CalendarIcon, Star, Plus, Share, MessageSquare, ThumbsUp, Trash2, X } from 'lucide-react';
import { Navbar, AddRecordModal } from '@/components';
import { useLogStore } from '@/stores/logStore';
import { useUserStore } from '@/stores/userStore';
import type { DrinkLog } from '@/types';
import styles from './RecordPage.module.css';

export function RecordPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [previewImages, setPreviewImages] = useState<string[] | null>(null);
  const [detailLog, setDetailLog] = useState<DrinkLog | null>(null);
  
  const { logs, fetchLogs, deleteLog, loading } = useLogStore();
  const { username, avatar } = useUserStore();

  useEffect(() => {
    // Fetch all logs to populate the calendar
    fetchLogs();
  }, [fetchLogs]);

  // Handle selected date logs
  const dateStr = format(selectedDate, 'yyyy-MM-dd');
  const selectedLogs = useMemo(() => {
    return logs.filter(log => log.date_str === dateStr);
  }, [logs, dateStr]);

  // Monthly summary
  const currentMonthStr = format(selectedDate, 'yyyy-MM');
  const monthlyLogs = useMemo(() => {
    return logs.filter(log => log.date_str.startsWith(currentMonthStr));
  }, [logs, currentMonthStr]);

  // Create a map of date string to logs for calendar tiles
  const logsByDate = useMemo(() => {
    const map = new Map<string, typeof logs>();
    logs.forEach(log => {
      const arr = map.get(log.date_str) || [];
      arr.push(log);
      map.set(log.date_str, arr);
    });
    return map;
  }, [logs]);

  const tileContent = ({ date, view }: { date: Date, view: string }) => {
    if (view === 'month') {
      const dStr = format(date, 'yyyy-MM-dd');
      const dayLogs = logsByDate.get(dStr);
      if (dayLogs && dayLogs.length > 0) {
        const firstLog = dayLogs[0];
        let coverImg = firstLog.recipe?.image_url;
        if (firstLog.images) {
          try {
            const imgs = JSON.parse(firstLog.images);
            if (imgs && imgs.length > 0) {
              coverImg = imgs[0];
            }
          } catch (e) {}
        }

        return (
          <div className={styles.tileContent}>
            {coverImg ? (
              <img src={coverImg} alt="drink" className={styles.tileImg} />
            ) : (
              <div className={styles.tilePlaceholder}>🍸</div>
            )}
            {dayLogs.length > 1 && (
              <div className={styles.tileBadge}>{dayLogs.length}</div>
            )}
          </div>
        );
      }
    }
    return null;
  };

  const handleAddSuccess = () => {
    fetchLogs();
  };

  const handleDelete = async (e: React.MouseEvent, logId: string) => {
    e.stopPropagation();
    if (window.confirm('确定要删除这条记录吗？')) {
      await deleteLog(logId);
      if (detailLog?.id === logId) {
        setDetailLog(null);
      }
    }
  };

  // Helper to extract first image
  const getCoverImage = (log: DrinkLog) => {
    if (log.images) {
      try {
        const imgs = JSON.parse(log.images);
        if (imgs && imgs.length > 0) return imgs[0];
      } catch (e) {}
    }
    return log.recipe?.image_url;
  };

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
            tileContent={tileContent}
            tileClassName={({ date }) => {
              const dStr = format(date, 'yyyy-MM-dd');
              return logsByDate.has(dStr) ? styles.hasLogTile : '';
            }}
          />
        </div>

        {/* 本月汇总 */}
        <div className={styles.summaryCard}>
          <div className={styles.summaryInfo}>
            <div className={styles.summaryTitle}>本月</div>
            <div className={styles.summaryCount}>
              {monthlyLogs.length} <span className={styles.summaryUnit}>杯</span>
            </div>
          </div>
          <div className={styles.summaryImages}>
            {monthlyLogs.slice(0, 4).map((log, i) => {
              const img = getCoverImage(log);
              return img ? (
                <img 
                  key={log.id} 
                  src={img} 
                  alt="drink" 
                  className={styles.summaryImg} 
                  style={{ zIndex: 10 - i, transform: `translateX(${-i * 15}px)` }}
                />
              ) : null;
            })}
          </div>
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
          ) : selectedLogs.length > 0 ? (
            <div className={styles.flatList}>
              {selectedLogs.map((log) => {
                let images: string[] = [];
                if (log.images) {
                  try {
                    images = JSON.parse(log.images);
                  } catch (e) {}
                } else if (log.recipe?.image_url) {
                  images = [log.recipe.image_url];
                }

                const displayImages = images.slice(0, 3);
                const extraCount = images.length - 3;

                return (
                  <div key={log.id} className={styles.flatRow} onClick={() => setDetailLog(log)}>
                    <div className={styles.flatRowTop}>
                      <div className={styles.flatRowHeader}>
                        <span className={styles.flatRowDrinkName}>{log.recipe?.name_zh || '未知酒款'}</span>
                        <span className={styles.flatRowTime}>{format(new Date(log.created_at * 1000), 'HH:mm')}</span>
                        {log.rating && (
                          <div className={styles.flatRowRating}>
                            <Star size={12} fill="#F5A623" color="#F5A623" />
                            <span>{log.rating}</span>
                          </div>
                        )}
                      </div>
                      <button 
                        className={styles.deleteBtnFlat} 
                        onClick={(e) => handleDelete(e, log.id)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {log.notes && (
                      <div className={styles.flatRowNotes}>
                        {log.notes}
                      </div>
                    )}

                    {displayImages.length > 0 && (
                      <div className={styles.flatRowImages}>
                        {displayImages.map((img, idx) => {
                          const isLast = idx === 2 && extraCount > 0;
                          return (
                            <div key={idx} className={styles.flatRowImgWrapper}>
                              <img src={img} alt="drink" className={styles.flatRowImg} />
                              {isLast && (
                                <div className={styles.flatRowMoreOverlay}>
                                  +{extraCount}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
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

      <button className={styles.fab} onClick={() => setIsAddModalOpen(true)}>
        <Plus size={20} />
      </button>

      <AddRecordModal 
        isOpen={isAddModalOpen} 
        onClose={() => setIsAddModalOpen(false)} 
        onSuccess={handleAddSuccess}
        selectedDateStr={dateStr}
      />

      {/* 记录详情弹窗 */}
      {detailLog && (
        <div className={styles.detailOverlay} onClick={() => setDetailLog(null)}>
          <div className={styles.detailModal} onClick={(e) => e.stopPropagation()}>
            <button className={styles.closeBtn} onClick={() => setDetailLog(null)}>
              <X size={24} />
            </button>
            
            <div className={styles.momentHeader}>
              <div className={styles.avatar} style={avatar ? { backgroundImage: `url(${avatar})` } : {}}>
                {!avatar && username.charAt(0).toUpperCase()}
              </div>
              <div className={styles.momentMeta}>
                <div className={styles.username}>{username}</div>
                <div className={styles.timeAndRating}>
                  <span className={styles.time}>{format(new Date(detailLog.created_at * 1000), 'h:mm a')}</span>
                  {detailLog.rating && (
                    <span className={styles.momentRating}>
                      <Star size={12} fill="#F5A623" color="#F5A623" />
                      {detailLog.rating}
                    </span>
                  )}
                </div>
              </div>
              <button 
                className={styles.detailDeleteBtn} 
                onClick={(e) => handleDelete(e, detailLog.id)}
              >
                <Trash2 size={18} />
              </button>
            </div>
            
            <div className={styles.momentContent}>
              {detailLog.notes && <div className={styles.momentNotes}>{detailLog.notes}</div>}
              <div className={styles.momentDrinkName}>喝了「{detailLog.recipe?.name_zh || '未知酒款'}」</div>
              
              {(() => {
                let images: string[] = [];
                if (detailLog.images) {
                  try {
                    images = JSON.parse(detailLog.images);
                  } catch (e) {}
                }
                
                if (images.length === 0 && detailLog.recipe?.image_url) {
                  images = [detailLog.recipe.image_url];
                }
                
                if (images.length === 0) return null;
                
                if (images.length === 1) {
                  return (
                    <img 
                      src={images[0]} 
                      alt="drink" 
                      className={styles.momentImgSingle} 
                      onClick={() => setPreviewImages(images)}
                    />
                  );
                }
                
                return (
                  <div className={styles.momentImgGrid}>
                    {images.map((img, idx) => (
                      <img 
                        key={idx}
                        src={img} 
                        alt="drink" 
                        className={styles.momentImgThumbDetail}
                        onClick={() => setPreviewImages(images)}
                      />
                    ))}
                  </div>
                );
              })()}
            </div>
            
            <div className={styles.momentFooter}>
              <button className={styles.actionBtn}><Share size={18} /> 分享</button>
              <button className={styles.actionBtn}><MessageSquare size={18} /> 评论</button>
              <button className={styles.actionBtn}><ThumbsUp size={18} /> 点赞</button>
            </div>
          </div>
        </div>
      )}

      {/* 图片预览器 */}
      {previewImages && previewImages.length > 0 && (
        <div className={styles.viewerOverlay} onClick={() => setPreviewImages(null)}>
          <div className={styles.viewerImgContainer}>
            {previewImages.map((img, idx) => (
              <img key={idx} src={img} alt={`preview ${idx}`} className={styles.viewerImg} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
