import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// Mise en forme des réponses du coach (titres, gras, listes, tableaux), adaptée au thème sombre.
const components: Components = {
  h1: ({ children }) => <h3 className="mt-3 mb-1 text-base font-bold text-text first:mt-0">{children}</h3>,
  h2: ({ children }) => <h3 className="mt-3 mb-1 text-[15px] font-bold text-text first:mt-0">{children}</h3>,
  h3: ({ children }) => <h4 className="mt-2.5 mb-1 text-sm font-semibold text-text first:mt-0">{children}</h4>,
  p: ({ children }) => <p className="my-1.5 leading-relaxed first:mt-0 last:mb-0">{children}</p>,
  strong: ({ children }) => <strong className="font-semibold text-text">{children}</strong>,
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => <ul className="my-1.5 space-y-1 pl-4 [list-style:disc] marker:text-muted">{children}</ul>,
  ol: ({ children }) => <ol className="my-1.5 list-decimal space-y-1 pl-5 marker:text-muted">{children}</ol>,
  li: ({ children }) => <li className="pl-0.5 leading-relaxed">{children}</li>,
  hr: () => <hr className="my-3 border-border" />,
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noreferrer" className="text-gym underline">
      {children}
    </a>
  ),
  code: ({ children }) => <code className="rounded bg-bg px-1 py-0.5 text-[0.9em]">{children}</code>,
  blockquote: ({ children }) => <blockquote className="my-2 border-l-2 border-border pl-3 text-text-2">{children}</blockquote>,
  table: ({ children }) => (
    <div className="my-2 -mx-1 overflow-x-auto">
      <table className="w-full border-collapse text-left text-[13px] tabular-nums">{children}</table>
    </div>
  ),
  th: ({ children }) => <th className="border-b border-border px-2 py-1 font-semibold text-text">{children}</th>,
  td: ({ children }) => <td className="border-b border-border/60 px-2 py-1 align-top">{children}</td>,
};

export default function Markdown({ text }: { text: string }) {
  return (
    <div className="text-sm text-text-2">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
}
