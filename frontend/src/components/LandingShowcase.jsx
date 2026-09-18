import React from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  Briefcase,
  Scale,
  Home,
  Layers,
  Building2,
  ArrowRight,
  MessageSquare,
  Sparkles
} from 'lucide-react';

export default function LandingShowcase() {
  const useCases = [
    {
      icon: TrendingUp,
      title: 'For Founders',
      desc: 'Investor pings, intros, the calendar tetris.',
      link: '/?prompt=Help%20me%20prioritize%20and%20organize%20my%20key%20tasks%20and%20exam%20deliverables'
    },
    {
      icon: Briefcase,
      title: 'For Investors',
      desc: 'Dealflow triaged, founders kept warm, intros that actually move.',
      link: '/?prompt=Summarize%20the%20top%20recurring%20patterns%20and%20yields%20from%20recent%20archives'
    },
    {
      icon: Scale,
      title: 'For Lawyers',
      desc: 'Scheduling, intake, billing follow-ups.',
      link: '/?prompt=Provide%20a%20structured%20clause-by-clause%20analysis%20with%20citations'
    },
    {
      icon: Home,
      title: 'For Real Estate Agents',
      desc: 'Leads answered the second they land, showings booked, closings on track.',
      link: '/?prompt=Draft%20a%20swift%20client%20intake%20and%20follow-up%20schedule'
    },
    {
      icon: Layers,
      title: 'For Agencies',
      desc: 'Client check-ins, status updates, calendar tetris across accounts.',
      link: '/?prompt=Structure%20a%20multi-project%20checkpoint%20and%20deliverable%20tracker'
    },
    {
      icon: Building2,
      title: 'For Enterprise',
      desc: 'Orchid for the whole company.',
      link: '/?prompt=How%20does%20Orchids%20scale%20across%20entire%20departments%20and%20universities%3F'
    }
  ];

  return (
    <div className="showcase-container">
      {/* Floating Showcase Box with 6 cards */}
      <div className="usecase-showcase-box">
        <div className="usecase-tag-label">USE CASE</div>
        <div className="usecase-cards-grid">
          {useCases.map((item, idx) => {
            const Icon = item.icon;
            return (
              <Link key={idx} to={item.link} className="usecase-card">
                <div className="usecase-card-icon">
                  <Icon size={19} strokeWidth={1.75} />
                </div>
                <h3 className="usecase-card-title">{item.title}</h3>
                <p className="usecase-card-desc">{item.desc}</p>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Hero Section */}
      <div className="hero-section">
        <h1 className="hero-title">
          Meet Orchids, the executive assistant that never sleeps.
        </h1>
        <p className="hero-subtitle">
          Orchids is your AI partner. It keeps your past papers, syllabus maps, quiz prep, and follow-ups moving, so you stay focused on the work that matters.
        </p>
        <div className="hero-cta-row">
          <Link to="/" className="hero-btn-dark">
            <MessageSquare size={16} />
            Start Chatting
          </Link>
          <Link to="/browse" className="hero-btn-link">
            See past papers →
          </Link>
          <Link to="/quiz" className="hero-btn-link">
            Take AI Quiz →
          </Link>
        </div>
      </div>
    </div>
  );
}
