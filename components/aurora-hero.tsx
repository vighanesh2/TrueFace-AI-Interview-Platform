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
        <span className="mb-1.5 inline-block rounded-full bg-gray-600/50 px-3 py-1.5 text-sm">TRUEFACE</span>
        <h1 className="max-w-3xl bg-gradient-to-br from-white to-gray-400 bg-clip-text text-center text-3xl font-medium leading-tight text-transparent sm:text-5xl sm:leading-tight md:text-7xl md:leading-tight">
          Interview the Real You.
        </h1>
        <p className="my-6 max-w-xl text-center text-base leading-relaxed text-gray-300 md:text-lg md:leading-relaxed">
          AI mock interviews and authenticity signals that measure skill, not scripts—technical depth and behavioral
          rounds in one workspace.
        </p>

        <motion.div
          style={{ border, boxShadow }}
          whileHover={{ scale: 1.015 }}
          whileTap={{ scale: 0.985 }}
          className="group relative w-fit rounded-full"
        >
          <Link
            href="/register"
            className="relative flex w-fit items-center gap-1.5 rounded-full bg-gray-950/10 px-4 py-2 text-gray-50 transition-colors hover:bg-gray-950/50"
          >
            Get started
            <FiArrowRight className="transition-transform group-hover:-rotate-45 group-active:-rotate-12" />
          </Link>
        </motion.div>

        <p className="mt-6 text-center text-sm text-gray-500">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-gray-300 underline-offset-2 hover:text-white hover:underline">
            Log in
          </Link>
        </p>
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
