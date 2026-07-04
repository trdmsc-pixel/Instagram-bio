'use client';

import { useState, useEffect } from 'react';
import { GITHUB_USERNAME, GITHUB_REPO } from './config';

export default function Home() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      // 1. Try public GitHub API (instant, bypasses Varnish cache)
      try {
        const apiUrl = `https://api.github.com/repos/${GITHUB_USERNAME}/${GITHUB_REPO}/contents/public/data.json?t=${Date.now()}`;
        const res = await fetch(apiUrl, {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        if (res.ok) {
          const json = await res.json();
          const decodedContent = decodeURIComponent(escape(atob(json.content)));
          const parsedData = JSON.parse(decodedContent);
          setData(parsedData);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.warn("GitHub API fetch failed/rate-limited, trying raw content:", err);
      }

      // 2. Try raw GitHub URL (fallback)
      try {
        const githubUrl = `https://raw.githubusercontent.com/${GITHUB_USERNAME}/${GITHUB_REPO}/main/public/data.json?t=${Date.now()}`;
        const res = await fetch(githubUrl, {
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        if (res.ok) {
          const json = await res.json();
          setData(json);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.warn("GitHub raw fetch failed, trying local file:", err);
      }

      // 3. Try local file (build fallback)
      try {
        const localRes = await fetch(`/data.json?t=${Date.now()}`);
        if (localRes.ok) {
          const json = await localRes.json();
          setData(json);
        }
      } catch (err) {
        console.error("Failed to load local data:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <main className="mobile-frame" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div className="bg-blobs">
          <div className="blob blob-1"></div>
          <div className="blob blob-2"></div>
          <div className="blob blob-3"></div>
        </div>
        <div className="loader-container">
          <div className="spinner"></div>
          <p style={{ marginTop: '16px', color: 'var(--text-secondary)', fontSize: '15px' }}>Loading decoded space...</p>
        </div>
      </main>
    );
  }

  const bio = data?.bio || {
    title: 'sham-decoded',
    avatar: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop',
    description: 'Welcome to my decoded space! Sharing the best tech, tools, and lifestyle products.'
  };
  const products = data?.products || [];

  return (
    <main className="mobile-frame animate-fade-in">
      {/* Background glowing blobs */}
      <div className="bg-blobs">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
      </div>

      {/* Profile Header */}
      <header className="profile-header">
        <div className="avatar-wrapper">
          <img 
            src={bio.avatar} 
            alt={bio.title}
            onError={(e) => {
              e.currentTarget.src = `https://api.dicebear.com/7.x/bottts/svg?seed=${bio.title}`;
            }}
          />
        </div>
        <h1>{bio.title}</h1>
        <p className="bio-desc">{bio.description}</p>
      </header>

      {/* Welcome Greeting */}
      <div className="glass-container welcome-card animate-slide-up" style={{ animationDelay: '0.1s' }}>
        <span className="welcome-tag">Hey there 👋</span>
        <p>Explore the curated products and gear I feature in my posts below. Tap any product to shop directly!</p>
      </div>

      {/* Products list */}
      <div className="products-container">
        {products.length === 0 ? (
          <div className="glass-container empty-state animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <p>No products tagged yet. Stay tuned!</p>
          </div>
        ) : (
          products.map((product, index) => (
            <a 
              key={product.id || index}
              href={product.url}
              target="_blank"
              rel="noopener noreferrer"
              className="glass-card product-card animate-slide-up"
              style={{ animationDelay: `${0.2 + index * 0.08}s` }}
            >
              <div className="thumbnail-wrapper">
                <img 
                  src={product.thumbnail || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=100&auto=format&fit=crop'} 
                  alt={product.name}
                  onError={(e) => {
                    e.currentTarget.src = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=100&auto=format&fit=crop';
                  }}
                  loading="lazy"
                />
              </div>
              <div className="product-info">
                <h3>{product.name}</h3>
                <span className="product-domain">
                  {(() => {
                    try {
                      return new URL(product.url).hostname.replace('www.', '');
                    } catch (e) {
                      return 'link';
                    }
                  })()}
                </span>
              </div>
              <div className="arrow-wrapper">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12h14M12 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </a>
          ))
        )}
      </div>

      {/* Elegant Footer */}
      <footer className="footer-credits animate-fade-in" style={{ animationDelay: '0.6s' }}>
        <p>© {new Date().getFullYear()} @{bio.title.toLowerCase().replace(/\s+/g, '')}</p>
      </footer>
    </main>
  );
}
