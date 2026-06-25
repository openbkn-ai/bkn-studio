/** 知识网络「立即体验」—— 智能问数对话：自然语言提问，基于本体检索作答 + 检索过程。 */

import { ArrowLeftOutlined, SendOutlined, ThunderboltFilled } from "@ant-design/icons";
import { Input, Spin } from "antd";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { getKnowledgeNetwork } from "@/modules/knowledge-network/services/knowledge-network.service";
import {
  SAMPLE_QUESTIONS,
  askKnowledgeNetwork,
  type ExperienceAnswer,
} from "@/modules/knowledge-network/services/experience.service";

import styles from "./ExperienceScene.module.css";

type ChatMessage =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "assistant"; pending: boolean; answer?: ExperienceAnswer };

function formatMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}

function TraceCard({ answer }: { answer: ExperienceAnswer }) {
  const { trace } = answer;
  const schema = [...trace.obj, ...trace.rel];
  return (
    <div className={styles.trace}>
      <div className={styles.traceHead}>
        检索过程
        <span className={styles.traceMeta}>
          {formatMs(answer.latencyMs)} · {trace.instances == null ? "纯 Schema" : `${trace.instances} 实例`} ·{" "}
          {answer.tokens} token
        </span>
      </div>
      {schema.length > 0 ? (
        <div className={styles.traceRow}>
          <span className={styles.traceLbl}>命中</span>
          <span className={styles.chips}>
            {schema.map((label) => (
              <span key={label} className={styles.chip}>
                {label}
              </span>
            ))}
          </span>
        </div>
      ) : null}
      <div className={styles.traceRow}>
        <span className={styles.traceLbl}>调用链</span>
        <span className={styles.chain}>
          {trace.tools.map((tool, index) => (
            <span key={tool} className={styles.chainStep}>
              {index > 0 ? <span className={styles.chainArrow}>→</span> : null}
              <span className={styles.chainDot} />
              {tool}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}

export function ExperienceScene() {
  const navigate = useNavigate();
  const { networkId } = useParams<{ networkId: string }>();
  const id = networkId ?? "";

  const [network, setNetwork] = useState<{ name: string; slug: string } | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const seq = useRef(0);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    getKnowledgeNetwork(id)
      .then((record) => {
        if (!cancelled && record) {
          setNetwork({ name: record.name, slug: record.identifier });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed || sending) {
        return;
      }
      const userId = `u${(seq.current += 1)}`;
      const botId = `a${(seq.current += 1)}`;
      setMessages((prev) => [
        ...prev,
        { id: userId, role: "user", text: trimmed },
        { id: botId, role: "assistant", pending: true },
      ]);
      setInput("");
      setSending(true);
      try {
        const answer = await askKnowledgeNetwork(network?.name ?? "知识网络", trimmed);
        setMessages((prev) =>
          prev.map((message) =>
            message.id === botId ? { id: botId, role: "assistant", pending: false, answer } : message,
          ),
        );
      } finally {
        setSending(false);
      }
    },
    [network, sending],
  );

  return (
    <section className={styles.page}>
      <button
        type="button"
        className={styles.backLink}
        onClick={() => navigate(`/knowledge-network/workspace/${id}/overview`)}
      >
        <ArrowLeftOutlined />
        返回 {network?.name ?? "知识网络"}
      </button>

      <div className={styles.titleRow}>
        <h2 className={styles.title}>立即体验</h2>
        <span className={styles.expBadge}>
          <ThunderboltFilled /> 智能问数
        </span>
        {network ? <span className={styles.slug}>{network.slug}</span> : null}
        <span className={styles.subMeta}>用自然语言提问，基于本体检索作答</span>
      </div>

      <div className={styles.chatCard}>
        <div className={styles.body} ref={bodyRef}>
          {messages.length === 0 ? (
            <div className={styles.welcome}>
              <div className={styles.welcomeIcon}>
                <ThunderboltFilled />
              </div>
              <div className={styles.welcomeTitle}>
                体验「{network?.name ?? "知识网络"}」的智能问数
              </div>
              <div className={styles.welcomeSub}>用自然语言提问，试试这些问题：</div>
              <div className={styles.samples}>
                {SAMPLE_QUESTIONS.map((question) => (
                  <button
                    key={question}
                    type="button"
                    className={styles.sample}
                    onClick={() => void send(question)}
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((message) =>
              message.role === "user" ? (
                <div key={message.id} className={`${styles.msg} ${styles.msgUser}`}>
                  <div className={styles.bubbleUser}>{message.text}</div>
                </div>
              ) : (
                <div key={message.id} className={`${styles.msg} ${styles.msgBot}`}>
                  <div className={styles.botAvatar}>
                    <ThunderboltFilled />
                  </div>
                  <div className={styles.bubbleBot}>
                    {message.pending ? (
                      <span className={styles.thinking}>
                        <Spin size="small" /> 检索作答中…
                      </span>
                    ) : message.answer ? (
                      <>
                        <div className={styles.answer}>{message.answer.answer}</div>
                        <TraceCard answer={message.answer} />
                      </>
                    ) : null}
                  </div>
                </div>
              ),
            )
          )}
        </div>

        <div className={styles.inputBar}>
          <Input.TextArea
            className={styles.input}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="输入问题，回车发送（Shift + 回车换行）"
            autoSize={{ minRows: 1, maxRows: 4 }}
            onPressEnter={(event) => {
              if (!event.shiftKey) {
                event.preventDefault();
                void send(input);
              }
            }}
          />
          <button
            type="button"
            className={styles.sendBtn}
            disabled={sending || input.trim().length === 0}
            onClick={() => void send(input)}
          >
            <SendOutlined />
          </button>
        </div>
      </div>
    </section>
  );
}
