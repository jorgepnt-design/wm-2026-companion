import type { CardType } from "../services/fifaApi";

interface Props {
  card: CardType;
  className?: string;
}

const labels: Record<Exclude<CardType, "none">, string> = {
  yellow: "Gelbe Karte",
  "yellow-red": "Gelb-Rote Karte",
  red: "Rote Karte",
};

const Rect = ({ color }: { color: string }) => (
  <span className={`inline-block h-3.5 w-2.5 rounded-[2px] shadow-sm shadow-black/40 ${color}`} aria-hidden />
);

// Kompakte Kartenanzeige: kleine farbige Rechtecke statt Emojis – auf jedem Geraet einheitlich.
export function CardBadge({ card, className = "" }: Props) {
  if (card === "none") return null;
  return (
    <span className={`inline-flex items-center gap-0.5 align-middle ${className}`} title={labels[card]} aria-label={labels[card]}>
      {card === "yellow" && <Rect color="bg-yellow-400" />}
      {card === "red" && <Rect color="bg-red-600" />}
      {card === "yellow-red" && (
        <>
          <Rect color="bg-yellow-400" />
          <Rect color="bg-red-600" />
        </>
      )}
    </span>
  );
}
