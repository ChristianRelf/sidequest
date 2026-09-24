"use client";
import { useEffect, useRef, useState } from "react";
import { CharacterArt, type CharacterName } from "./character-art";
export type CharacterState =
  | "idle"
  | "notice"
  | "hop"
  | "travel"
  | "land"
  | "celebrate"
  | "think"
  | "tired"
  | "recover"
  | "sleep";
export const characterStates: CharacterState[] = [
  "idle",
  "notice",
  "hop",
  "travel",
  "land",
  "celebrate",
  "think",
  "tired",
  "recover",
  "sleep",
];
export type CharacterProps={character?:CharacterName;state?:CharacterState;event?:number;reduced?:boolean;paused?:boolean;className?:string;onSettled?:()=>void};
export default function Character({
  character = "pip",
  state = "idle",
  event = 0,
  reduced = false,
  paused = false,
  className = "",
  onSettled,
}: CharacterProps) {
  const ref = useRef<SVGSVGElement>(null),
    clips = useRef<Animation[]>([]),
    settled = useRef(onSettled);
  settled.current = onSettled;
  const [visible, setVisible] = useState(true),
    [systemReduced, setSystemReduced] = useState(false);
  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    setSystemReduced(query.matches);
    const fn = () => setSystemReduced(query.matches);
    query.addEventListener("change", fn);
    return () => query.removeEventListener("change", fn);
  }, []);
  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    let intersect = true;
    const update = () => setVisible(intersect && !document.hidden);
    const observer = new IntersectionObserver(
      ([entry]) => {
        intersect = entry.isIntersecting;
        update();
      },
      { threshold: 0.05 },
    );
    observer.observe(svg);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  useEffect(() => {
    const svg = ref.current;
    if (!svg || !svg.animate) return;
    clips.current.forEach((a) => a.cancel());
    clips.current = [];
    const minimal = reduced || systemReduced;
    const weight = character === "moss" ? 1.22 : character === "zip" ? 0.85 : 1;
    function animate(
      joint: string,
      frames: Keyframe[],
      duration: number,
      delay = 0,
      iterations = 1,
    ) {
      const el = svg!.querySelector<SVGElement>(`[data-joint="${joint}"]`);
      if (!el) return;
      el.style.transformBox = "fill-box";
      el.style.transformOrigin = joint.startsWith("arm")
        ? "50% 10%"
        : joint.startsWith("leg")
          ? "50% 0%"
          : "50% 80%";
      const a = el.animate(frames.map(frame=>({...frame,easing:'cubic-bezier(.2,.7,.2,1)'})), {
        duration: duration * weight,
        delay: delay * weight,
        iterations,
        easing: "linear",
        fill: iterations === Infinity ? "none" : "forwards",
      });
      clips.current.push(a);
      return a;
    }
    const pose = (values: string[]) =>
      values.map((transform) => ({ transform }));
    if (minimal) {
      const clip = animate(
        "face",
        pose(["translateY(0)", "translateY(-1px)", "translateY(0)"]),
        180,
      );
      if (state !== "idle")
        clip?.finished.then(() => settled.current?.()).catch(() => {});
      return () => clips.current.forEach((a) => a.cancel());
    }
    let duration = 0;
    if (state === "idle") {
      animate(
        "body",
        pose(["scaleY(1)", "scaleY(1.015)", "scaleY(1)"]),
        4800,
        0,
        Infinity,
      );
      animate(
        "eyes",
        [
          { opacity: 1, offset: 0 },
          { opacity: 1, offset: 0.91 },
          { opacity: 0, offset: 0.93 },
          { opacity: 0, offset: 0.95 },
          { opacity: 1, offset: 0.97 },
          { opacity: 1 },
        ],
        6200,
        0,
        Infinity,
      );
      animate(
        "lids",
        [
          { opacity: 0, offset: 0 },
          { opacity: 0, offset: 0.91 },
          { opacity: 1, offset: 0.93 },
          { opacity: 1, offset: 0.95 },
          { opacity: 0, offset: 0.97 },
          { opacity: 0 },
        ],
        6200,
        0,
        Infinity,
      );
    } else if (state === "travel") {
      duration = 1500;
      animate(
        "root",
        pose([
          "translateX(105px) translateY(-8px) rotate(12deg)",
          "translateX(60px) translateY(-30px) rotate(-5deg)",
          "translateX(22px) translateY(0) scale(1.08,.9)",
          "translateX(7px) translateY(-20px)",
          "translateX(0) translateY(0) scale(1.08,.9)",
          "translateX(0) translateY(0) scale(1)",
        ]),
        1500,
      );
      animate(
        "leg-l",
        pose([
          "rotate(-20deg)",
          "rotate(25deg)",
          "rotate(-15deg)",
          "rotate(0)",
        ]),
        1300,
      );
      animate(
        "leg-r",
        pose(["rotate(20deg)", "rotate(-25deg)", "rotate(15deg)", "rotate(0)"]),
        1300,
      );
      animate(
        "scarf-tail",
        pose(["rotate(-12deg)", "rotate(18deg)", "rotate(0)"]),
        1500,
        60,
      );
    } else if (state === "hop" || state === "celebrate") {
      duration = state === "celebrate" ? 1600 : 950;
      animate(
        "root",
        pose([
          "translateY(0) scale(1)",
          "translateY(5px) scale(1.09,.88)",
          "translateY(-38px) scale(.96,1.05) rotate(-4deg)",
          "translateY(-33px) rotate(3deg)",
          "translateY(1px) scale(1.12,.86)",
          "translateY(0) scale(1)",
        ]),
        duration,
      );
      animate(
        "shadow",
        pose([
          "scaleX(1)",
          "scaleX(1.08)",
          "scaleX(.6)",
          "scaleX(.65)",
          "scaleX(1.1)",
          "scaleX(1)",
        ]),
        duration,
      );
      animate(
        "arm-l",
        pose([
          "rotate(0)",
          "rotate(15deg)",
          "rotate(105deg)",
          "rotate(100deg)",
          "rotate(-8deg)",
          "rotate(0)",
        ]),
        duration,
      );
      animate(
        "arm-r",
        pose([
          "rotate(0)",
          "rotate(-15deg)",
          "rotate(-105deg)",
          "rotate(-100deg)",
          "rotate(8deg)",
          "rotate(0)",
        ]),
        duration,
      );
      animate(
        "scarf-tail",
        pose([
          "rotate(0)",
          "rotate(0)",
          "rotate(-25deg)",
          "rotate(12deg)",
          "rotate(-7deg)",
          "rotate(0)",
        ]),
        duration,
        60,
      );
      animate(
        "prop",
        pose([
          "rotate(0)",
          "rotate(-5deg)",
          "rotate(10deg)",
          "rotate(-8deg)",
          "rotate(0)",
        ]),
        duration,
        40,
      );
      if (state === "celebrate") {
        animate(
          "eyes",
          pose([
            "scaleY(1)",
            "scaleY(1)",
            "scaleY(.35)",
            "scaleY(.35)",
            "scaleY(1)",
          ]),
          duration,
        );
        animate(
          "head",
          pose(["rotate(0)", "rotate(-6deg)", "rotate(4deg)", "rotate(0)"]),
          duration,
        );
      }
    } else if (state === "land") {
      duration = 500;
      animate(
        "root",
        pose([
          "translateY(-16px)",
          "translateY(2px) scale(1.12,.87)",
          "translateY(0) scale(1)",
        ]),
        500,
      );
      animate(
        "scarf-tail",
        pose(["rotate(-12deg)", "rotate(12deg)", "rotate(0)"]),
        600,
      );
    } else if (state === "notice") {
      duration = 800;
      animate(
        "face",
        pose([
          "translateX(0)",
          "translateX(5px)",
          "translateX(5px)",
          "translateX(0)",
        ]),
        800,
      );
      animate("head", pose(["rotate(0)", "rotate(-6deg)", "rotate(0)"]), 800);
    } else if (state === "recover") {
      duration = 1800;
      animate(
        "body",
        pose([
          "rotate(0)",
          "rotate(-7deg) translateY(3px)",
          "rotate(3deg)",
          "rotate(0)",
        ]),
        1800,
      );
      animate(
        "arm-r",
        pose(["rotate(0)", "rotate(-65deg)", "rotate(-50deg)", "rotate(0)"]),
        1700,
      );
      animate(
        "prop",
        pose(["rotate(0)", "rotate(12deg)", "rotate(-8deg)", "rotate(0)"]),
        1800,
      );
      animate(
        "head",
        pose(["rotate(0)", "rotate(8deg)", "rotate(-4deg)", "rotate(0)"]),
        1800,
      );
    } else if (state === "think") {
      duration = 1800;
      animate(
        "head",
        pose(["rotate(0)", "rotate(-9deg)", "rotate(-9deg)", "rotate(0)"]),
        1800,
      );
      animate(
        "arm-r",
        pose(["rotate(0)", "rotate(-75deg)", "rotate(-75deg)", "rotate(0)"]),
        1800,
      );
      animate(
        "face",
        pose(["translate(0,0)", "translate(3px,-3px)", "translate(0,0)"]),
        1800,
      );
    } else {
      animate(
        "body",
        pose(["translateY(0)", "translateY(5px) scaleY(.96)"]),
        500,
      );
      animate("eyes", [{ opacity: 1 }, { opacity: 0 }], 400);
      animate("lids", [{ opacity: 0 }, { opacity: 1 }], 400);
      if (state === "sleep")
        animate(
          "body",
          pose([
            "translateY(5px) scaleY(.96)",
            "translateY(3px) scaleY(.98)",
            "translateY(5px) scaleY(.96)",
          ]),
          6000,
          500,
          Infinity,
        );
      else duration = 2000;
    }
    // Animation.finished is cancelled with the clip, avoiding stale transitions after interruption.
    if (duration) {
      const lead = clips.current[0];
      lead?.finished.then(() => settled.current?.()).catch(() => {});
    }
    if (paused || !visible) clips.current.forEach((a) => a.pause());
    return () => {
      clips.current.forEach((a) => a.cancel());
      clips.current = [];
    };
  }, [character, state, event, reduced, systemReduced]);
  useEffect(() => {
    clips.current.forEach((a) => (paused || !visible ? a.pause() : a.play()));
  }, [paused, visible]);
  return (
    <CharacterArt
      ref={ref}
      character={character}
      className={`character ${className}`}
      role="img"
      aria-label={`${character === "pip" ? "Pip the pathfinder" : character === "zip" ? "Zip the momentum keeper" : "Moss the recovery companion"}, ${state}`}
    />
  );
}
