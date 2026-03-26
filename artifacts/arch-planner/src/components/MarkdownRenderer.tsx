import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface MarkdownRendererProps {
  content: string;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="prose prose-invert prose-teal max-w-none w-full">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content || "..."}
      </ReactMarkdown>
    </div>
  );
}
