import { useState, useEffect, useCallback } from "react";
import { useTranslation } from 'react-i18next';
import { Button } from "../ui/button";
import { MdCheck } from "react-icons/md";
import { IoRefresh } from "react-icons/io5";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Card } from "../ui/card";
import styles from "./SourceSelector.module.css";

interface DesktopSource {
  id: string;
  name: string;
  thumbnail: string | null;
  display_id: string;
  appIcon: string | null;
}

// 改进窗口名称解析
function parseWindowName(source: { id: string; name: string }): string {
  // 如果不是窗口类型，直接返回原名称
  if (!source.id.startsWith('window:')) {
    return source.name || '未知屏幕';
  }
  
  const name = source.name || '';
  
  // 处理常见的窗口名称格式
  // 格式1: "应用名 — 窗口标题" (macOS 风格)
  if (name.includes(' — ')) {
    const parts = name.split(' — ');
    // 返回窗口标题（通常更有意义）
    return parts[parts.length - 1] || parts[0] || name;
  }
  
  // 格式2: "窗口标题 - 应用名" (Windows 风格)
  if (name.includes(' - ')) {
    const parts = name.split(' - ');
    // 返回窗口标题
    return parts[0] || name;
  }
  
  // 格式3: "应用名: 窗口标题"
  if (name.includes(': ')) {
    const parts = name.split(': ');
    return parts[parts.length - 1] || parts[0] || name;
  }
  
  // 如果名称为空或只有空格，返回默认名称
  if (!name.trim()) {
    return '未命名窗口';
  }
  
  return name;
}

export function SourceSelector() {
  const { t } = useTranslation();
  const [sources, setSources] = useState<DesktopSource[]>([]);
  const [selectedSource, setSelectedSource] = useState<DesktopSource | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 获取源列表
  const fetchSources = useCallback(async (preserveSelection = false) => {
    const previousSelectedId = selectedSource?.id;
    
    try {
      const rawSources = await window.electronAPI.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 320, height: 180 },
        fetchWindowIcons: true
      });
      
      console.log('Raw sources count:', rawSources.length);
      
      const processedSources = rawSources.map(source => {
        const processedName = parseWindowName(source);
        console.log(`Source: ${source.id} -> "${source.name}" -> "${processedName}"`);
        return {
          id: source.id,
          name: processedName,
          thumbnail: source.thumbnail,
          display_id: source.display_id,
          appIcon: source.appIcon
        };
      });
      
      setSources(processedSources);
      
      // 如果需要保持选择，检查之前选中的源是否仍然存在
      if (preserveSelection && previousSelectedId) {
        const stillExists = processedSources.find(s => s.id === previousSelectedId);
        if (stillExists) {
          setSelectedSource(stillExists);
        } else {
          // 源不再存在，清除选择
          setSelectedSource(null);
        }
      }
    } catch (error) {
      console.error('Error loading sources:', error);
    }
  }, [selectedSource?.id]);

  // 初始加载
  useEffect(() => {
    async function initialLoad() {
      setLoading(true);
      await fetchSources(false);
      setLoading(false);
    }
    initialLoad();
  }, []);

  // 刷新源列表
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchSources(true);
    setIsRefreshing(false);
  };

  const screenSources = sources.filter(s => s.id.startsWith('screen:'));
  const windowSources = sources.filter(s => s.id.startsWith('window:'));

  const handleSourceSelect = (source: DesktopSource) => setSelectedSource(source);
  const handleShare = async () => {
    if (selectedSource) await window.electronAPI.selectSource(selectedSource);
  };

  if (loading) {
    return (
      <div className={`h-full flex items-center justify-center ${styles.glassContainer}`} style={{ minHeight: '100vh' }}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-zinc-600 mx-auto mb-2" />
          <p className="text-xs text-zinc-300">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center ${styles.glassContainer}`}>
      <div className="flex-1 flex flex-col w-full max-w-xl" style={{ padding: 0 }}>
        <Tabs defaultValue="screens">
          <div className="flex items-center justify-between mb-3">
            <TabsList className="grid grid-cols-2 flex-1 bg-zinc-900/40 rounded-full">
              <TabsTrigger value="screens" className="data-[state=active]:bg-[#34B27B] data-[state=active]:text-white text-zinc-200 rounded-full text-xs py-1">
                {t('common.screens')} ({screenSources.length})
              </TabsTrigger>
              <TabsTrigger value="windows" className="data-[state=active]:bg-[#34B27B] data-[state=active]:text-white text-zinc-200 rounded-full text-xs py-1">
                {t('common.windows')} ({windowSources.length})
              </TabsTrigger>
            </TabsList>
            
            {/* 刷新按钮 */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="ml-2 p-2 text-zinc-400 hover:text-white hover:bg-zinc-800/50"
              title={t('common.refresh', '刷新')}
            >
              <IoRefresh size={16} className={isRefreshing ? 'animate-spin' : ''} />
            </Button>
          </div>
          
          <div className="h-60 flex flex-col justify-stretch">
            <TabsContent value="screens" className="h-full">
              {screenSources.length === 0 ? (
                <div className="h-full flex items-center justify-center text-zinc-400 text-xs">
                  {t('recording.no_screens', '未检测到屏幕')}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 h-full overflow-y-auto pr-1 relative">
                  {screenSources.map(source => (
                    <Card
                      key={source.id}
                      className={`${styles.sourceCard} ${selectedSource?.id === source.id ? styles.selected : ''} cursor-pointer h-fit p-2 scale-95`}
                      style={{ margin: 8, width: '90%', maxWidth: 220 }}
                      onClick={() => handleSourceSelect(source)}
                    >
                      <div className="p-1">
                        <div className="relative mb-1">
                          <img
                            src={source.thumbnail || ''}
                            alt={source.name}
                            className="w-full aspect-video object-cover rounded border border-zinc-800"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '';
                              (e.target as HTMLImageElement).style.background = '#27272a';
                            }}
                          />
                          {selectedSource?.id === source.id && (
                            <div className="absolute -top-1 -right-1">
                              <div className="w-4 h-4 bg-[#34B27B] rounded-full flex items-center justify-center shadow-md">
                                <MdCheck className={styles.icon} />
                              </div>
                            </div>
                          )}
                        </div>
                        <div className={styles.name + " truncate"} title={source.name}>{source.name}</div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
            <TabsContent value="windows" className="h-full">
              {windowSources.length === 0 ? (
                <div className="h-full flex items-center justify-center text-zinc-400 text-xs flex-col gap-2">
                  <span>{t('recording.no_windows', '未检测到窗口')}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="text-xs text-zinc-400 hover:text-white"
                  >
                    <IoRefresh size={14} className={`mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
                    {t('common.refresh', '刷新')}
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 h-full overflow-y-auto pr-1 relative">
                  {windowSources.map(source => (
                    <Card
                      key={source.id}
                      className={`${styles.sourceCard} ${selectedSource?.id === source.id ? styles.selected : ''} cursor-pointer h-fit p-2 scale-95`}
                      style={{ margin: 8, width: '90%', maxWidth: 220 }}
                      onClick={() => handleSourceSelect(source)}
                    >
                      <div className="p-1">
                        <div className="relative mb-1">
                          <img
                            src={source.thumbnail || ''}
                            alt={source.name}
                            className="w-full aspect-video object-cover rounded border border-gray-700"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = '';
                              (e.target as HTMLImageElement).style.background = '#27272a';
                            }}
                          />
                          {selectedSource?.id === source.id && (
                            <div className="absolute -top-1 -right-1">
                              <div className="w-4 h-4 bg-[#34B27B] rounded-full flex items-center justify-center shadow-md">
                                <MdCheck className={styles.icon} />
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          {source.appIcon && (
                            <img
                              src={source.appIcon}
                              alt="App icon"
                              className={styles.icon + " flex-shrink-0"}
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          )}
                          <div className={styles.name + " truncate"} title={source.name}>{source.name}</div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </div>
      <div className="border-t border-zinc-800 p-2 w-full max-w-xl">
        <div className="flex justify-center gap-2">
          <Button variant="outline" onClick={() => window.close()} className="px-4 py-1 text-xs bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700">{t('common.cancel')}</Button>
          <Button onClick={handleShare} disabled={!selectedSource} className="px-4 py-1 text-xs bg-[#34B27B] text-white hover:bg-[#34B27B]/80 disabled:opacity-50 disabled:bg-zinc-700">{t('common.share')}</Button>
        </div>
      </div>
    </div>
  );
}
