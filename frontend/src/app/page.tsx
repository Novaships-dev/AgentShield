'use client'

import Navbar from '@/components/landing/Navbar'
import Hero from '@/components/landing/Hero'
import ModuleCards from '@/components/landing/ModuleCards'
import BentoFeatures from '@/components/landing/BentoFeatures'
import HowItWorks from '@/components/landing/HowItWorks'
import CodePreview from '@/components/landing/CodePreview'
import Pricing from '@/components/landing/Pricing'
import Comparison from '@/components/landing/Comparison'
import FAQ from '@/components/landing/FAQ'
import FinalCTA from '@/components/landing/FinalCTA'
import Footer from '@/components/landing/Footer'
import useScrollReveal from '@/hooks/useScrollReveal'

export default function LandingPage() {
  useScrollReveal()

  return (
    <main style={{ background: '#030014', minHeight: '100vh' }}>
      <Navbar />
      <Hero />
      <ModuleCards />
      <BentoFeatures />
      <HowItWorks />
      <CodePreview />
      <Pricing />
      <Comparison />
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  )
}
