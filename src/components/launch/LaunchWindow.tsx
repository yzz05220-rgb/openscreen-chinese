import { useState, useEffect } from "react";
import { useScreenRecorder } from "../../hooks/useScreenRecorder";
import { Button } from "../ui/button";
import { BsRecordCircle } from "react-icons/bs";
import { FaRegStopCircle } from "react-icons/fa";
import { MdMonitor } from "react-icons/md";

export function LaunchWindow() {
  const { recording, toggleRecording } = useScreenRecorder();
  const [selectedSource, setSelectedSource] = useState("Screen");
  const [hasSelectedSource, setHasSelectedSource] = useState(false);

  useEffect(() => {
    const checkSelectedSource = async () => {
      if (window.electronAPI) {
        const source = await window.electronAPI.getSelectedSource();
        if (source) {
          setSelectedSource(source.name);
          setHasSelectedSource(true);
        } else {
          setSelectedSource("Screen");
          setHasSelectedSource(false);
        }
      }
    };

    checkSelectedSource();
    
    const interval = setInterval(checkSelectedSource, 500);
    return () => clearInterval(interval);
  }, []);

  const truncateText = (text: string, maxLength: number = 6) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  const openSourceSelector = () => {
    if (window.electronAPI) {
      window.electronAPI.openSourceSelector();
    }
  };

  return (
    <div className="w-full h-full flex items-center bg-transparent">
      <div className="w-full max-w-2xl mx-auto flex items-center justify-between backdrop-blur-xl bg-black/80 rounded-full px-6 py-3 shadow-2xl border border-white/20">
        <Button
          variant="link"
          size="sm"
          className="gap-2 text-white bg-transparent hover:bg-transparent px-0 flex-1 text-left"
          onClick={openSourceSelector}
        >
          <MdMonitor size={16} className="text-white" />
          {truncateText(selectedSource)}
        </Button>

        <div className="w-px h-6 bg-white/30" />

        <Button
          variant="link"
          size="sm"
          onClick={hasSelectedSource ? toggleRecording : openSourceSelector}
          disabled={!hasSelectedSource && !recording}
          className="gap-2 bg-transparent hover:bg-transparent px-0 flex-1 text-right"
        >
          {recording ? (
            <>
              <FaRegStopCircle size={16} className="text-red-400" />
              <span className="text-red-400">Stop</span>
            </>
          ) : (
            <>
              <BsRecordCircle size={16} className={hasSelectedSource ? "text-white" : "text-white/50"} />
              <span className={hasSelectedSource ? "text-white" : "text-white/50"}>Record</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
