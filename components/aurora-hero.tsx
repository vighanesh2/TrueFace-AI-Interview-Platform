"use client";

import { Stars } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { animate, motion, useMotionTemplate, useMotionValue } from "framer-motion";
import Link from "next/link";
import { Suspense, useEffect } from "react";
import { FiArrowRight } from "react-icons/fi";

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
        <h1 className="max-w-4xl bg-linear-to-br from-white to-gray-400 bg-clip-text text-center text-3xl font-medium leading-none text-transparent sm:text-5xl md:text-7xl">
          TrueFace
        </h1>
        <p className="mt-0.5 max-w-4xl text-center text-base font-normal leading-tight text-gray-300 sm:mt-1 sm:text-lg md:text-xl">
          Interview the Real You.
        </p>
        <p className="mt-4 mb-6 max-w-2xl text-center text-base leading-relaxed text-gray-300 md:mt-5 md:text-lg md:leading-relaxed">
          AI-powered mock interviews and fraud detection that measure skill, reveal authenticity, and make hiring truly
          trustworthy.
        </p>

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
