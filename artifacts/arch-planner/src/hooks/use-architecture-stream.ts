import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getListArchitectureSessionsQueryKey, type CreateArchitectureSessionBody } from "@workspace/api-client-react";

// Hook for creating a session and streaming the plan
export function useGenerateArchitecturePlan() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [content, setContent] = useState("");
  const queryClient = useQueryClient();

  const generate = async (data: CreateArchitectureSessionBody): Promise<{ text: string; sessionId: number | null }> => {
    setIsGenerating(true);
    setContent("");
    
    try {
      const res = await fetch("/api/architecture/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      
      if (!res.ok) throw new Error("Failed to start generation");
      
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      let sessionId: number | null = null;

      if (!reader) throw new Error("No readable stream available");

      let buffer = "";
      let streamDone = false;
      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep the incomplete line in the buffer
        
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6).trim();
            if (!dataStr || dataStr === "[DONE]") continue;
            
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.done) {
                if (parsed.error) {
                  throw new Error(parsed.error as string);
                }
                if (parsed.sessionId != null) {
                  sessionId = parsed.sessionId as number;
                }
                streamDone = true;
                break;
              }
              if (parsed.content) {
                fullText += parsed.content;
                setContent(fullText);
              }
            } catch (e) {
              console.error("SSE JSON parse error:", e, dataStr);
            }
          }
        }
      }
      
      // Invalidate the sessions list so the sidebar updates
      await queryClient.invalidateQueries({ 
        queryKey: getListArchitectureSessionsQueryKey() 
      });
      
      return { text: fullText, sessionId };
    } catch (error) {
      console.error("Generation error:", error);
      throw error;
    } finally {
      setIsGenerating(false);
    }
  };

  return { generate, isGenerating, content };
}

// Hook for sending follow-up questions via SSE
export function useArchitectureFollowup() {
  const [isAnswering, setIsAnswering] = useState(false);
  const [answerStream, setAnswerStream] = useState("");
  
  const askFollowup = async (sessionId: number, question: string, onComplete?: () => void) => {
    setIsAnswering(true);
    setAnswerStream("");
    
    try {
      const res = await fetch(`/api/architecture/sessions/${sessionId}/followup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      
      if (!res.ok) throw new Error("Failed to send follow-up");
      
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      if (!reader) throw new Error("No readable stream available");

      let buffer = "";
      let followupDone = false;
      while (!followupDone) {
        const { done, value } = await reader.read();
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; 
        
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6).trim();
            if (!dataStr || dataStr === "[DONE]") continue;
            
            let parsed: Record<string, unknown>;
            try {
              parsed = JSON.parse(dataStr) as Record<string, unknown>;
            } catch {
              continue;
            }

            if (parsed.done) {
              if (parsed.error) {
                throw new Error(parsed.error as string);
              }
              followupDone = true;
              break;
            }
            if (parsed.content) {
              fullText += parsed.content as string;
              setAnswerStream(fullText);
            }
          }
        }
      }
      
      if (onComplete) onComplete();
      return fullText;
    } catch (error) {
      console.error("Follow-up error:", error);
      throw error;
    } finally {
      setIsAnswering(false);
    }
  };

  return { askFollowup, isAnswering, answerStream };
}
