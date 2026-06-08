import { FeatureGrid } from '@/components/landing/FeatureGrid'
import { Footer } from '@/components/landing/Footer'
import { Hero } from '@/components/landing/Hero'
import { Nav } from '@/components/landing/Nav'
import { TechStack } from '@/components/landing/TechStack'

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-base text-primary">
      <Nav />
      <Hero />
      <FeatureGrid />
      <TechStack />
      <Footer />
    </main>
  )
}
