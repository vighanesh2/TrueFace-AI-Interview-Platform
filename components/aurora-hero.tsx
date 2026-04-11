"use client";

import { Stars } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { animate, motion, useMotionTemplate, useMotionValue } from "framer-motion";
import Link from "next/link";
import { Suspense, useEffect } from "react";
import { FiArrowRight } from "react-icons/fi";
import { TextAnimate } from "@/registry/magicui/text-animate";

const COLORS_TOP = ["#13FFAA", "#1E67C6", "#CE84CF", "#DD335C"];

export function AuroraHero() {
  const color = useMotionValue(COLORS_TOP[0]);

  useEffect(() => {
    const ctrl = animate(color, COLORS_TOP, {
      ease: "easeInOut",
      duration: 10,
      repeat: Infinity,
      repeatType: "mirror",
    });
    return () => ctrl.stop();
  }, [color]);

  const backgroundImage = useMotionTemplate`radial-gradient(125% 125% at 50% 0%, #020617 50%, ${color})`;
  const border = useMotionTemplate`1px solid ${color}`;
  const boxShadow = useMotionTemplate`0px 4px 24px ${color}`;

  return (
    <motion.section
      style={{ backgroundImage }}
      className="relative grid min-h-screen place-content-center overflow-hidden bg-gray-950 px-4 py-24 text-gray-200"
    >
      <div className="relative z-10 flex flex-col items-center">
        <span className="mb-1.5 inline-block rounded-full bg-gray-600/50 px-3 py-1.5 text-sm">
          TRUEFACE
        </span>
        <TextAnimate
          as="h1"
          animation="blurInUp"
          by="character"
          once
          startOnView={false}
          duration={0.6}
          className="max-w-4xl text-center text-3xl font-medium leading-tight text-white sm:text-5xl sm:leading-tight md:text-7xl md:leading-tight"
          segmentClassName="text-white"
        >
          Interview the Real You.
        </TextAnimate>
        <TextAnimate
          as="p"
          animation="blurInUp"
          by="word"
          once
          startOnView={false}
          delay={0.15}
          duration={0.5}
          className="my-6 max-w-2xl text-center text-base leading-relaxed text-gray-300 md:text-lg md:leading-relaxed"
          segmentClassName="text-gray-300 md:text-gray-200"
        >
          AI-powered mock interviews and fraud detection that measure skill, reveal authenticity, and make hiring truly
          trustworthy.
        </TextAnimate>

        <motion.div
          style={{ border, boxShadow }}
          whileHover={{ scale: 1.015 }}
          whileTap={{ scale: 0.985 }}
          className="w-fit rounded-full"
        >
          <Link
            href="/register"
            className="group relative flex w-full items-center gap-1.5 rounded-full bg-gray-950/40 px-5 py-2.5 text-gray-50 transition-colors hover:bg-gray-950/70"
          >
            Get started
            <FiArrowRight className="transition-transform group-hover:-rotate-45 group-active:-rotate-12" />
          </Link>
        </motion.div>
      </div>

      <div className="pointer-events-none absolute inset-0 z-0">
        <Canvas
          camera={{ position: [0, 0, 1] }}
          dpr={[1, 2]}
          gl={{ alpha: true, antialias: false }}
          className="h-full w-full"
        >
          <Suspense fallback={null}>
            <Stars radius={50} depth={50} count={2500} factor={4} fade speed={2} />
          </Suspense>
        </Canvas>
      </div>
    </motion.section>
  );
}
