import { Fragment } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../theme";

/**
 * Enough markdown for a summary, which is prose: paragraphs, the occasional
 * bullet, bold, italics, inline code and links. A whole markdown library for
 * that would be more code than this, and more to go wrong.
 */

type Block = { kind: "paragraph" | "bullet"; text: string };

function blocksOf(markdown: string): Block[] {
  const blocks: Block[] = [];

  for (const chunk of markdown.split(/\n{2,}/)) {
    for (const line of chunk.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const bullet = /^(?:[-*+]|\d+\.)\s+(.*)$/.exec(trimmed);
      if (bullet?.[1]) {
        blocks.push({ kind: "bullet", text: bullet[1] });
        continue;
      }

      const heading = /^#{1,6}\s+(.*)$/.exec(trimmed);
      const last = blocks.at(-1);
      const text = heading?.[1] ?? trimmed;

      // Hard-wrapped prose is one paragraph, not one per line.
      if (!heading && last?.kind === "paragraph" && !chunk.startsWith(line)) last.text += ` ${text}`;
      else blocks.push({ kind: "paragraph", text });
    }
  }

  return blocks;
}

const INLINE = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;

function Inline({ text }: { text: string }) {
  const theme = useTheme();

  return (
    <>
      {text.split(INLINE).map((part, index) => {
        const key = `${index}-${part.slice(0, 12)}`;

        if (/^(\*\*|__).+(\*\*|__)$/.test(part)) {
          return (
            <Text key={key} style={{ fontWeight: "700" }}>
              {part.slice(2, -2)}
            </Text>
          );
        }
        if (/^[*_].+[*_]$/.test(part)) {
          return (
            <Text key={key} style={{ fontStyle: "italic" }}>
              {part.slice(1, -1)}
            </Text>
          );
        }
        if (/^`.+`$/.test(part)) {
          return (
            <Text key={key} style={{ fontFamily: "Courier", fontSize: 14, color: theme.muted }}>
              {part.slice(1, -1)}
            </Text>
          );
        }

        const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
        if (link?.[1] && link[2]) {
          const href = link[2];
          return (
            <Text
              key={key}
              onPress={() => void Linking.openURL(href)}
              style={{ color: theme.accent, textDecorationLine: "underline" }}
            >
              {link[1]}
            </Text>
          );
        }

        return <Fragment key={key}>{part}</Fragment>;
      })}
    </>
  );
}

export function Markdown({ children }: { children: string }) {
  const theme = useTheme();
  const styles = useStyles();

  return (
    <View>
      {blocksOf(children).map((block, index) =>
        block.kind === "bullet" ? (
          <View key={index} style={styles.bulletRow}>
            <View style={[styles.dot, { backgroundColor: theme.accent }]} />
            <Text style={[styles.body, { color: theme.ink }]}>
              <Inline text={block.text} />
            </Text>
          </View>
        ) : (
          <Text key={index} style={[styles.body, styles.paragraph, { color: theme.ink }]}>
            <Inline text={block.text} />
          </Text>
        ),
      )}
    </View>
  );
}

const useStyles = () =>
  StyleSheet.create({
    body: { fontSize: 17, lineHeight: 28 },
    paragraph: { marginBottom: 18 },
    bulletRow: { flexDirection: "row", gap: 12, marginBottom: 12, paddingRight: 8 },
    dot: { width: 6, height: 6, borderRadius: 3, marginTop: 11 },
  });
