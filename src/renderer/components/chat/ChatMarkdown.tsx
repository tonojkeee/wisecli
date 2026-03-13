import * as React from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "@renderer/lib/utils";

interface ChatMarkdownProps {
  content: string;
  className?: string;
}

/**
 * Refined markdown renderer for chat messages.
 * Handles code blocks, inline code, bold, italic, links, and lists.
 */
export function ChatMarkdown({ content, className }: ChatMarkdownProps) {
  const renderedContent = React.useMemo(() => {
    if (content == null) return null;
    return parseMarkdown(content);
  }, [content]);

  return (
    <div
      className={cn(
        "prose prose-sm prose-invert max-w-none prose-p:leading-relaxed prose-p:my-1",
        className
      )}
    >
      {renderedContent}
    </div>
  );
}

function parseMarkdown(content: string): React.ReactNode[] {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let codeLanguage = "";
  let codeBlockKey = 0;
  let listItems: string[] = [];
  let listKey = 0;

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(
        <ul
          key={`list-${listKey++}`}
          className="my-2 ml-4 list-disc space-y-0.5 marker:text-muted-foreground"
        >
          {listItems.map((item, idx) => (
            <li key={idx} className="text-sm leading-relaxed pl-1">
              {parseInlineMarkdown(item)}
            </li>
          ))}
        </ul>
      );
      listItems = [];
    }
  };

  lines.forEach((line, index) => {
    // Code block handling
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        elements.push(
          <CodeBlock
            key={`code-${codeBlockKey++}`}
            language={codeLanguage}
            code={codeBlockContent.join("\n")}
          />
        );
        codeBlockContent = [];
        codeLanguage = "";
        inCodeBlock = false;
      } else {
        flushList();
        inCodeBlock = true;
        codeLanguage = line.slice(3).trim();
      }
      return;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      return;
    }

    // List handling
    const listMatch = line.match(/^(\s*)[-*]\s+(.+)/);
    if (listMatch) {
      listItems.push(listMatch[2]);
      return;
    }

    flushList();

    // Empty line
    if (line.trim() === "") {
      return;
    }

    // Headers
    if (line.startsWith("### ")) {
      elements.push(
        <h4 key={`h4-${index}`} className="mt-3 mb-1.5 text-sm font-semibold text-foreground">
          {parseInlineMarkdown(line.slice(4))}
        </h4>
      );
      return;
    }
    if (line.startsWith("## ")) {
      elements.push(
        <h3 key={`h3-${index}`} className="mt-3 mb-1.5 text-base font-semibold text-foreground">
          {parseInlineMarkdown(line.slice(3))}
        </h3>
      );
      return;
    }
    if (line.startsWith("# ")) {
      elements.push(
        <h2 key={`h2-${index}`} className="mt-3 mb-1.5 text-lg font-semibold text-foreground">
          {parseInlineMarkdown(line.slice(2))}
        </h2>
      );
      return;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      elements.push(
        <blockquote
          key={`quote-${index}`}
          className="border-l-2 border-primary/30 pl-3 text-sm italic text-muted-foreground"
        >
          {parseInlineMarkdown(line.slice(2))}
        </blockquote>
      );
      return;
    }

    // Regular paragraph
    elements.push(
      <p key={`p-${index}`} className="text-sm leading-relaxed">
        {parseInlineMarkdown(line)}
      </p>
    );
  });

  flushList();

  if (inCodeBlock && codeBlockContent.length > 0) {
    elements.push(
      <CodeBlock
        key={`code-${codeBlockKey}`}
        language={codeLanguage}
        code={codeBlockContent.join("\n")}
      />
    );
  }

  return elements;
}

function parseInlineMarkdown(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Inline code
    const inlineCodeMatch = remaining.match(/`([^`]+)`/);
    if (inlineCodeMatch && inlineCodeMatch.index !== undefined) {
      if (inlineCodeMatch.index > 0) {
        parts.push(remaining.slice(0, inlineCodeMatch.index));
      }
      parts.push(
        <code
          key={`inline-code-${key++}`}
          className="rounded-md bg-muted/70 px-1.5 py-0.5 font-mono text-xs text-foreground"
        >
          {inlineCodeMatch[1]}
        </code>
      );
      remaining = remaining.slice(inlineCodeMatch.index + inlineCodeMatch[0].length);
      continue;
    }

    // Bold
    const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
    if (boldMatch && boldMatch.index !== undefined) {
      if (boldMatch.index > 0) {
        parts.push(remaining.slice(0, boldMatch.index));
      }
      parts.push(
        <strong key={`bold-${key++}`} className="font-semibold text-foreground">
          {boldMatch[1]}
        </strong>
      );
      remaining = remaining.slice(boldMatch.index + boldMatch[0].length);
      continue;
    }

    // Italic
    const italicMatch = remaining.match(/\*([^*]+)\*/);
    if (italicMatch && italicMatch.index !== undefined) {
      if (italicMatch.index > 0) {
        parts.push(remaining.slice(0, italicMatch.index));
      }
      parts.push(
        <em key={`italic-${key++}`} className="italic">
          {italicMatch[1]}
        </em>
      );
      remaining = remaining.slice(italicMatch.index + italicMatch[0].length);
      continue;
    }

    // Links
    const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch && linkMatch.index !== undefined) {
      if (linkMatch.index > 0) {
        parts.push(remaining.slice(0, linkMatch.index));
      }
      parts.push(
        <a
          key={`link-${key++}`}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
        >
          {linkMatch[1]}
        </a>
      );
      remaining = remaining.slice(linkMatch.index + linkMatch[0].length);
      continue;
    }

    parts.push(remaining);
    break;
  }

  return parts.length > 0 ? parts : text;
}

interface CodeBlockProps {
  language: string;
  code: string;
}

function CodeBlock({ language, code }: CodeBlockProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative my-2 overflow-hidden rounded-xl border border-border/50 bg-muted/30">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/30 bg-muted/20 px-3 py-1.5">
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {language || "code"}
        </span>
        <button
          onClick={handleCopy}
          className={cn(
            "flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium",
            "text-muted-foreground hover:text-foreground",
            "bg-muted/30 hover:bg-muted/50",
            "transition-all duration-200"
          )}
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-green-500" />
              <span className="text-green-500">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code */}
      <pre className="overflow-x-auto p-3 text-xs">
        <code className="font-mono leading-relaxed text-foreground/90">{code}</code>
      </pre>
    </div>
  );
}

export default ChatMarkdown;
