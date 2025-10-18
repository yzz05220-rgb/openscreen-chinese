import { useState, useEffect } from "react";
import { Button } from "../ui/button";
import { MdCheck } from "react-icons/md";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Card } from "../ui/card";

interface DesktopSource {
  id: string;
  name: string;
  thumbnail: string | null;
  display_id: string;
  appIcon: string | null;
}

export function SourceSelector() {
  const [sources, setSources] = useState<DesktopSource[]>([]);
  const [selectedSource, setSelectedSource] = useState<DesktopSource | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSources() {
      setLoading(true);
      try {
        const rawSources = await window.electronAPI.getSources({
          types: ['screen', 'window'],
          thumbnailSize: { width: 320, height: 180 },
          fetchWindowIcons: true
        });
        setSources(
          rawSources.map(source => ({
            id: source.id,
            name:
              source.id.startsWith('window:') && source.name.includes(' — ')
                ? source.name.split(' — ')[1] || source.name
                : source.name,
            thumbnail: source.thumbnail,
            display_id: source.display_id,
            appIcon: source.appIcon
          }))
        );
      } catch (error) {
        console.error('Error loading sources:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchSources();
  }, []);

  const screenSources = sources.filter(s => s.id.startsWith('screen:'));
  const windowSources = sources.filter(s => s.id.startsWith('window:'));

  const handleSourceSelect = (source: DesktopSource) => setSelectedSource(source);
  const handleShare = async () => {
    if (selectedSource) await window.electronAPI.selectSource(selectedSource);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-600">Loading sources...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <div className="flex-1 flex flex-col p-4 bg-white">
        <Tabs defaultValue="screens">
          <TabsList className="grid grid-cols-2 mb-4 bg-blue-50 rounded-full">
            <TabsTrigger value="screens" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-blue-700 rounded-full">Screens</TabsTrigger>
            <TabsTrigger value="windows" className="data-[state=active]:bg-blue-600 data-[state=active]:text-white text-blue-700 rounded-full">Windows</TabsTrigger>
          </TabsList>
          <div className="h-64">
            <TabsContent value="screens" className="h-full">
              <div className="grid grid-cols-2 gap-3 h-full overflow-y-auto pr-2">
                {screenSources.map(source => (
                  <Card
                    key={source.id}
                    className={`cursor-pointer transition hover:shadow-lg h-fit p-3 scale-90 ${selectedSource?.id === source.id ? 'ring-2 ring-blue-600 bg-blue-50 z-10' : 'hover:ring-1 hover:ring-blue-200 bg-white border border-blue-100'}`}
                    style={{ margin: 12, width: '80%', maxWidth: 320 }}
                    onClick={() => handleSourceSelect(source)}
                  >
                    <div className="p-2">
                      <div className="relative mb-2">
                        <img
                          src={source.thumbnail || ''}
                          alt={source.name}
                          className="w-full aspect-video object-cover rounded border border-gray-300"
                        />
                        {selectedSource?.id === source.id && (
                          <div className="absolute -top-1 -right-1">
                            <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center shadow-md">
                              <MdCheck className="w-3 h-3 text-white" />
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="text-xs font-medium text-blue-700 truncate">{source.name}</div>
                    </div>
                  </Card>
                ))}
              </div>
            </TabsContent>
            <TabsContent value="windows" className="h-full">
              <div className="grid grid-cols-2 gap-3 h-full overflow-y-auto pr-2">
                {windowSources.map(source => (
                  <Card
                    key={source.id}
                    className={`cursor-pointer transition hover:shadow-lg h-fit p-3 scale-90 ${selectedSource?.id === source.id ? 'ring-2 ring-blue-600 bg-blue-50 z-10' : 'hover:ring-1 hover:ring-blue-200 bg-white border border-blue-100'}`}
                    style={{ margin: 12, width: '80%', maxWidth: 320 }}
                    onClick={() => handleSourceSelect(source)}
                  >
                    <div className="p-2">
                      <div className="relative mb-2">
                        <img
                          src={source.thumbnail || ''}
                          alt={source.name}
                          className="w-full aspect-video object-cover rounded border border-gray-300"
                        />
                        {selectedSource?.id === source.id && (
                          <div className="absolute -top-1 -right-1">
                            <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center shadow-md">
                              <MdCheck className="w-3 h-3 text-white" />
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {source.appIcon && (
                          <img
                            src={source.appIcon}
                            alt="App icon"
                            className="w-3 h-3 flex-shrink-0"
                          />
                        )}
                        <div className="text-xs font-medium text-blue-700 truncate">{source.name}</div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
      <div className="border-t border-blue-100 p-3">
        <div className="flex justify-center gap-3">
          <Button variant="outline" onClick={() => window.close()} className="px-6 py-1.5 text-sm bg-blue-600 border-blue-600 text-white hover:bg-blue-700">Cancel</Button>
          <Button onClick={handleShare} disabled={!selectedSource} className="px-6 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:bg-blue-300">Share</Button>
        </div>
      </div>
    </div>
  );
}
