import { useId } from "react";
import type { SVGProps } from "react";

export type CharacterName = "pip" | "zip" | "moss";
export type CharacterMood = "happy" | "focused" | "sleepy";

export interface CharacterArtProps extends SVGProps<SVGSVGElement> {
  character?: CharacterName;
  mood?: CharacterMood;
}

type ArtProps = {
  mood: CharacterMood;
  ids: {
    purple: string;
    mint: string;
    coral: string;
    cream: string;
    shadow: string;
  };
};

const C = {
  ink: "#263232",
  cream: "#FFF5DE",
  creamShade: "#F1DDBB",
  blush: "#EC9E8F",
  purple: "#8581EF",
  purpleDark: "#625DCB",
  purpleLight: "#B9B4FF",
  coral: "#F08C6C",
  coralDark: "#CD6658",
  mint: "#9CDDC0",
  mintDark: "#60AD8D",
  mintLight: "#C8F0D5",
  yellow: "#F5D475",
  brown: "#A7635C",
  boot: "#354141",
  leaf: "#86B38A",
} as const;

function Eyes({
  mood,
  y = 100,
  gap = 30,
}: {
  mood: CharacterMood;
  y?: number;
  gap?: number;
}) {
  const left = 120 - gap / 2;
  const right = 120 + gap / 2;

  if (mood === "sleepy") {
    return (
      <g data-joint="eyes">
        <path
          d={`M${left - 5} ${y + 2}q5 4 10 0M${right - 5} ${y + 2}q5 4 10 0`}
        />
        <path d={`M115 ${y + 16}q5 3 10 0`} strokeWidth="2.4" />
      </g>
    );
  }

  if (mood === "focused") {
    return (
      <g data-joint="eyes">
        <path
          d={`m${left - 6} ${y - 5} 11 3m${right - 5} 0 11-3`}
          strokeWidth="2.5"
        />
        <ellipse
          cx={left}
          cy={y + 4}
          rx="3.4"
          ry="5"
          fill={C.ink}
          stroke="none"
        />
        <ellipse
          cx={right}
          cy={y + 4}
          rx="3.4"
          ry="5"
          fill={C.ink}
          stroke="none"
        />
        <path d={`M114 ${y + 17}q6-3 12 0`} strokeWidth="2.4" />
      </g>
    );
  }

  return (
    <g data-joint="eyes">
      <ellipse cx={left} cy={y} rx="3.7" ry="5.8" fill={C.ink} stroke="none" />
      <ellipse cx={right} cy={y} rx="3.7" ry="5.8" fill={C.ink} stroke="none" />
      <circle cx={left + 1.2} cy={y - 2} r="1.1" fill="white" stroke="none" />
      <circle cx={right + 1.2} cy={y - 2} r="1.1" fill="white" stroke="none" />
      <path d={`M113 ${y + 14}q7 7 14 0`} strokeWidth="2.5" />
    </g>
  );
}

function Pip({ mood, ids }: ArtProps) {
  return (
    <g data-character="pip">
      <g data-joint="scarf-tail">
        <path
          d="M145 126c17-5 33-1 45 8l-13 8 13 13c-18 1-32-5-44-16Z"
          fill={C.coral}
        />
        <path
          d="M159 132c7 4 13 9 18 16"
          stroke={C.coralDark}
          strokeWidth="2"
          opacity=".65"
        />
      </g>

      <g data-joint="leg-l">
        <path d="M91 174c-1 10-3 21-3 30l20 1 3-31Z" fill={C.purpleDark} />
        <path
          d="M88 196c-11 3-18 10-13 17h36l-1-15c-7 3-14 3-22-2Z"
          fill={C.boot}
        />
        <path d="M79 207h27" stroke="#65706F" strokeWidth="2" />
      </g>
      <g data-joint="leg-r">
        <path d="m132 174 3 31h20l-6-33Z" fill={C.purpleDark} />
        <path
          d="m135 198 1 15h36c4-7-7-14-19-16-5 4-11 4-18 1Z"
          fill={C.boot}
        />
        <path d="M140 207h27" stroke="#65706F" strokeWidth="2" />
      </g>

      <path
        d="M79 118c-7 17-13 43-10 58 4 20 91 23 99 1 4-13-5-43-16-60Z"
        fill={`url(#${ids.purple})`}
      />
      <path
        d="M147 126c6 17 12 39 7 51-5 11-26 14-45 11 31 8 53 2 59-11 4-13-5-43-16-60Z"
        fill={C.purpleDark}
        opacity=".55"
        stroke="none"
      />
      <path
        d="M82 170c22 9 54 10 80 0"
        stroke={C.purpleLight}
        strokeWidth="2"
        opacity=".7"
      />

      <g data-joint="arm-l">
        <path
          d="M84 128c-14 4-23 14-27 28-3 10 5 17 13 12l24-27Z"
          fill={C.purple}
        />
        <path d="M60 155c-2 7 4 13 10 13l7-8-11-8Z" fill={C.cream} />
        <path d="m61 159 7 3" stroke={C.blush} strokeWidth="2" />
      </g>
      <g data-joint="arm-r">
        <path
          d="M154 127c15 4 24 15 27 29 2 10-8 16-15 9l-21-25Z"
          fill={C.purpleDark}
        />
        <path d="M173 153c7 1 10 7 7 12-3 5-10 4-14 0Z" fill={C.cream} />
      </g>

      <g data-joint="head">
        <path
          d="M63 107c-2-29 31-67 61-85l14 28c27 4 44 27 42 53-1 13-8 23-18 30-31 9-72 7-93-8-4-5-6-11-6-18Z"
          fill={`url(#${ids.purple})`}
        />
        <path
          d="M124 23c-6 25-18 43-35 57"
          stroke={C.purpleLight}
          strokeWidth="6"
          opacity=".85"
        />
        <path
          d="M138 50c18 4 35 19 40 39-8-11-20-18-33-21Z"
          fill={C.purpleDark}
          opacity=".35"
          stroke="none"
        />
        <path
          d="M79 91c6-20 29-28 53-23 24 4 35 19 31 38-4 20-21 29-42 28-26-1-43-13-44-30-1-4 0-9 2-13Z"
          fill={`url(#${ids.cream})`}
        />
        <path
          d="M83 89c9-11 24-17 40-17 14 0 27 4 35 13-12-5-27-7-42-5-13 1-24 4-33 9Z"
          fill="#FFF9EC"
          stroke="none"
          opacity=".9"
        />
        <g data-joint="face">
          <Eyes mood={mood} y={101} gap={32} />
          <path
            d="m88 113 9 2m46-2 9-2"
            stroke={C.blush}
            strokeWidth="4"
            opacity=".7"
          />
        </g>
        <path
          d="M68 119c28 17 65 19 96 4l-1 13c-31 15-67 13-95-3Z"
          fill={C.coral}
        />
        <path
          d="M71 121c28 13 62 14 90 2"
          stroke="#FFB08F"
          strokeWidth="2"
          opacity=".8"
        />
      </g>

      <path d="m92 139 51 43" stroke={C.ink} strokeWidth="7" />
      <path d="m92 139 51 43" stroke="#E8C78E" strokeWidth="3.5" />
      <g data-joint="prop">
        <path d="m128 162 32 2-2 27-31-4Z" fill="#DCA866" />
        <path d="m129 163 15 13 16-11" fill="#F5D492" />
        <path d="m144 176 1 6" strokeWidth="2.5" />
        <circle cx="145" cy="181" r="2.6" fill={C.coral} stroke="none" />
      </g>
      <path
        d="m91 160 8 2m48 5 8-1"
        stroke={C.purpleLight}
        strokeWidth="2"
        opacity=".7"
      />
    </g>
  );
}

function Zip({ mood, ids }: ArtProps) {
  return (
    <g data-character="zip">
      <g data-joint="scarf-tail">
        <path
          d="M150 119c17-1 30-8 43-18l-3 19 14 9c-17 8-32 8-47 3Z"
          fill={C.yellow}
        />
        <path d="m171 115 18-7" stroke="#D8AA45" strokeWidth="2" />
      </g>

      <g data-joint="leg-l">
        <path d="m91 174-2 31h20l3-32Z" fill={C.yellow} />
        <path
          d="M88 196c-11 2-18 10-13 17h36l-1-15c-7 3-15 2-22-2Z"
          fill={C.boot}
        />
        <path d="m92 184 18 3m-19 7 18 3" stroke={C.cream} strokeWidth="2" />
      </g>
      <g data-joint="leg-r">
        <path d="m133 173 2 32h20l-5-34Z" fill={C.yellow} />
        <path
          d="m135 197 1 16h36c4-7-7-14-19-16-5 4-11 4-18 0Z"
          fill={C.boot}
        />
        <path d="m135 185 17-3m-17 12 19-3" stroke={C.cream} strokeWidth="2" />
      </g>

      <path
        d="m76 116 43-52 47 47-5 55-39 31-43-28Z"
        fill={`url(#${ids.mint})`}
      />
      <path
        d="m121 69 1 127 39-30 5-55Z"
        fill={C.mintDark}
        opacity=".55"
        stroke="none"
      />
      <path
        d="M83 163c22 13 52 15 74 1"
        stroke={C.mintLight}
        strokeWidth="2"
        opacity=".75"
      />

      <g data-joint="arm-l">
        <path
          d="M83 126c-14 3-24 13-29 27-4 11 5 18 14 11l25-24Z"
          fill={C.mint}
        />
        <path d="M57 152c-4 5 0 13 7 14l9-7-10-10Z" fill={C.cream} />
      </g>
      <g data-joint="arm-r">
        <path
          d="M155 124c17 4 25 17 27 32 1 10-10 14-16 7l-20-25Z"
          fill={C.mintDark}
        />
        <path d="M174 151c6 0 10 6 7 11-2 5-9 5-15 1Z" fill={C.cream} />
      </g>

      <g data-joint="head">
        <path
          d="m84 95-4-45 28 25 10-42 20 40 34-22-11 47c-20 13-55 15-77-3Z"
          fill={`url(#${ids.mint})`}
        />
        <path d="m85 57 21 23-16 7Z" fill={C.mintLight} stroke="none" />
        <path
          d="m143 75 23-16-8 29Z"
          fill={C.mintDark}
          opacity=".7"
          stroke="none"
        />
        <path
          d="M82 94c18-13 57-15 78 0l-5 28c-6 13-19 20-34 20-16 0-29-7-36-20Z"
          fill={`url(#${ids.cream})`}
        />
        <path
          d="M88 93c17-7 45-9 66-1-17-1-36 2-51 8Z"
          fill="#FFF9EC"
          stroke="none"
        />
        <g data-joint="face">
          <Eyes mood={mood} y={106} gap={30} />
          <path
            d="m91 118 8 2m43-2 8-2"
            stroke={C.blush}
            strokeWidth="4"
            opacity=".65"
          />
        </g>
      </g>

      <path d="m98 139 24 10 24-11-5 14-19 10-19-9Z" fill={C.yellow} />
      <path d="m121 163-8 12 9-3 7 10 5-19Z" fill="#F7E6A8" strokeWidth="2.2" />
      <g data-joint="prop">
        <path d="m170 163 14-57" stroke={C.ink} strokeWidth="4" />
        <path d="m184 107 28 8-32 15Z" fill={C.yellow} />
        <path d="m185 112 17 4-19 8" stroke="#FFF0AE" strokeWidth="2" />
      </g>
    </g>
  );
}

function Moss({ mood, ids }: ArtProps) {
  return (
    <g data-character="moss">
      <g data-joint="leg-l">
        <path d="m91 174-2 31h20l3-31Z" fill="#77798C" />
        <path
          d="M88 197c-11 2-18 9-13 16h36l-1-15c-8 3-15 3-22-1Z"
          fill={C.boot}
        />
        <path d="M80 207h26" stroke="#65706F" strokeWidth="2" />
      </g>
      <g data-joint="leg-r">
        <path d="m133 173 2 32h20l-5-33Z" fill="#77798C" />
        <path
          d="m135 198 1 15h36c4-7-7-14-19-16-5 4-11 4-18 1Z"
          fill={C.boot}
        />
        <path d="M141 207h26" stroke="#65706F" strokeWidth="2" />
      </g>

      <path
        d="M85 112c-3 20-16 52-10 65 9 20 78 19 89 1 7-13-7-46-15-66Z"
        fill={`url(#${ids.cream})`}
      />
      <path
        d="M145 127c9 19 17 41 9 52-5 7-19 10-34 10 23 5 39 0 44-11 7-13-7-46-15-66Z"
        fill={C.creamShade}
        opacity=".65"
        stroke="none"
      />
      <path
        d="M82 171c22 9 52 10 76 1"
        stroke="#FFF9EC"
        strokeWidth="2"
        opacity=".8"
      />

      <g data-joint="arm-l">
        <path
          d="M84 128c-15 4-23 15-27 29-3 10 6 16 14 10l23-27Z"
          fill="#E8B89D"
        />
        <path d="M59 154c-2 7 4 13 11 13l7-8-11-8Z" fill={C.cream} />
      </g>
      <g data-joint="arm-r">
        <path
          d="M154 126c16 5 24 18 26 32 1 10-10 14-16 6l-19-25Z"
          fill="#D89D87"
        />
        <path d="M173 152c6 0 10 6 7 11-3 5-10 4-16 1Z" fill={C.cream} />
      </g>

      <g data-joint="head">
        <path
          d="M49 102c5-39 34-65 72-62 37 3 64 31 72 61 3 12-25 21-68 22-46 2-80-7-76-21Z"
          fill={`url(#${ids.coral})`}
        />
        <path
          d="M50 105c30 10 101 9 143-3 6 17-31 29-71 30-39 1-75-8-72-27Z"
          fill={C.brown}
        />
        <path
          d="M57 104c31 7 92 7 129-3-10 12-39 18-69 18-27 0-50-5-60-15Z"
          fill="#C9786D"
          stroke="none"
        />
        <path
          d="M75 73c4-8 12-14 22-18m42 2c9 3 16 9 21 17"
          stroke="#F3B09A"
          strokeWidth="10"
          opacity=".9"
        />
        <path d="M113 76c5-5 12-7 18-4" stroke="#F7C0AA" strokeWidth="9" />
        <path
          d="M87 118h65l-4 26c-8 11-18 17-29 17-13 0-23-6-30-17Z"
          fill={`url(#${ids.cream})`}
        />
        <path d="M92 119h55c-15 5-35 6-53 3Z" fill="#FFF9EC" stroke="none" />
        <g data-joint="face">
          <Eyes mood={mood} y={132} gap={28} />
          <path
            d="m94 143 8 2m36-2 8-2"
            stroke={C.blush}
            strokeWidth="4"
            opacity=".7"
          />
        </g>
      </g>

      <path d="m102 156 20 7 20-8-5 14-16 6-16-7Z" fill="#74788F" />
      <circle cx="122" cy="166" r="3" fill={C.yellow} />
      <g data-joint="prop">
        <path d="m169 166 15-38" stroke={C.ink} strokeWidth="3.5" />
        <path d="M180 143c-17-16 5-30 25-23-1 18-11 28-25 23Z" fill={C.leaf} />
        <path d="m180 143 16-16" stroke="#527D61" strokeWidth="2" />
        <path d="m188 135 1-8m-3 5 8 1" stroke="#527D61" strokeWidth="1.5" />
      </g>
      <g data-joint="satchel">
        <path d="M83 149c5 6 9 13 11 22" stroke="#805A4A" strokeWidth="4" />
        <path d="m81 167 24-2 2 19-26 1Z" fill="#B47B5F" />
        <path d="m82 167 12 8 11-9" fill="#CF9875" />
      </g>
    </g>
  );
}

/**
 * Production character artwork for Sidequest.
 * Every major piece is grouped with data-joint so GSAP, Motion or a WebGL
 * texture pipeline can animate it without changing the illustration.
 */
export function CharacterArt({
  character = "pip",
  mood = "happy",
  ...props
}: CharacterArtProps) {
  const uid = useId().replace(/:/g, "");
  const ids = {
    purple: `${uid}-purple`,
    mint: `${uid}-mint`,
    coral: `${uid}-coral`,
    cream: `${uid}-cream`,
    shadow: `${uid}-shadow`,
  };
  const label = props["aria-label"] ?? `${character} character`;

  return (
    <svg
      viewBox="0 0 240 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={label}
      {...props}
    >
      <defs>
        <linearGradient
          id={ids.purple}
          x1="79"
          y1="38"
          x2="163"
          y2="190"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#A6A2FA" />
          <stop offset="1" stopColor={C.purple} />
        </linearGradient>
        <linearGradient
          id={ids.mint}
          x1="88"
          y1="50"
          x2="153"
          y2="191"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor={C.mintLight} />
          <stop offset="1" stopColor={C.mint} />
        </linearGradient>
        <linearGradient
          id={ids.coral}
          x1="83"
          y1="43"
          x2="154"
          y2="121"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#F4A18B" />
          <stop offset="1" stopColor={C.coral} />
        </linearGradient>
        <linearGradient
          id={ids.cream}
          x1="105"
          y1="82"
          x2="132"
          y2="181"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#FFFAED" />
          <stop offset="1" stopColor={C.cream} />
        </linearGradient>
        <filter id={ids.shadow} x="-20%" y="-100%" width="140%" height="300%">
          <feGaussianBlur stdDeviation="3.5" />
        </filter>
      </defs>

      <ellipse
        data-joint="shadow"
        cx="121"
        cy="215"
        rx="50"
        ry="7"
        fill={C.ink}
        opacity=".16"
        filter={`url(#${ids.shadow})`}
      />
      <g
        data-joint="root"
        stroke={C.ink}
        strokeWidth="3.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {character === "pip" && <Pip mood={mood} ids={ids} />}
        {character === "zip" && <Zip mood={mood} ids={ids} />}
        {character === "moss" && <Moss mood={mood} ids={ids} />}
      </g>
    </svg>
  );
}
