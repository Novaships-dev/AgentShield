'use client'

import dynamic from 'next/dynamic'
import Navbar from '@/components/landing/Navbar'
import Hero from '@/components/landing/Hero'
import SocialProof from '@/components/landing/SocialProof'
import ModuleCards from '@/components/landing/ModuleCards'
import useScrollReveal from '@/hooks/useScrollReveal'

const BentoFeatures = dynamic(() => import('@/components/landing/BentoFeatures'))
const HowItWorks = dynamic(() => import('@/components/landing/HowItWorks'))
const CodePreview = dynamic(() => import('@/components/landing/CodePreview'))
const Pricing = dynamic(() => import('@/components/landing/Pricing'))
const Comparison = dynamic(() => import('@/components/landing/Comparison'))
const FAQ = dynamic(() => import('@/components/landing/FAQ'))
const FinalCTA = dynamic(() => import('@/components/landing/FinalCTA'))
const Footer = dynamic(() => import('@/components/landing/Footer'))

export default function LandingPage() {
  useScrollReveal()

  return (
    <main style={{ background: '#030014', minHeight: '100vh' }}>
      <Navbar />
      <Hero />
      <SocialProof />
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
