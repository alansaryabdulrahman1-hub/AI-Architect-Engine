import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useState, useCallback, type ReactNode } from "react";
import { Copy, Check } from "lucide-react";

interface MarkdownRendererProps {
  content: string;
}

function CodeBlock({ children, className }: { children: ReactNode; className?: string }) {
  const [copied, setCopied] = useState(false);

  const codeText = extractText(children);
  const language = className?.replace("language-", "") || "";

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(codeText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [codeText]);

  return (
    <div className="relative group my-4">
      <div className="flex items-center justify-between bg-zinc-800/80 rounded-t-xl px-4 py-2 text-xs text-zinc-400 border-b border-zinc-700/50">
        <span className="font-mono uppercase tracking-wider">{language || "code"}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-zinc-700 transition-colors text-zinc-400 hover:text-zinc-200"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-teal-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? "تم النسخ!" : "نسخ"}</span>
        </button>
      </div>
      <pre className="bg-zinc-900/80 rounded-b-xl p-4 overflow-x-auto text-sm leading-relaxed border border-t-0 border-zinc-700/30">
        <code className={`${className || ""} text-zinc-300`}>{children}</code>
      </pre>
    </div>
  );
}

function extractText(node: ReactNode): string {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (node && typeof node === "object" && "props" in node) {
    return extractText((node as { props: { children?: ReactNode } }).props.children);
  }
  return "";
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="prose prose-invert prose-teal max-w-none w-full">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          pre({ children }) {
            return <>{children}</>;
          },
          code({ children, className, ...props }) {
            const isBlock = className?.startsWith("language-");
            if (isBlock) {
              return <CodeBlock className={className}>{children}</CodeBlock>;
            }
            return (
              <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-teal-300 text-sm" {...props}>
                {children}
              </code>
            );
          },
        }}
      >
        {content || "..."}
      </ReactMarkdown>
    </div>
  );
}
