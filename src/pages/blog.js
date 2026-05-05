import React, { useState, useEffect } from 'react';
import Layout from '@theme/Layout';
import styles from './blog.module.css';
import { Users, Terminal, ExternalLink, BookOpen, Calendar, Star, GitFork, ArrowRight, Loader2, Hash, Github, ChevronLeft, ChevronRight } from 'lucide-react';

import HomeBackButton from '@site/src/components/HomeBackButton';

// ─── HASHNODE GRAPHQL ────────────────────────────────────────────────
const HASHNODE_API = 'https://gql.hashnode.com';
const QUERY = `
  query {
    publication(host: "yashv521.hashnode.dev") {
      posts(first: 9) {
        edges {
          node {
            title
            brief
            slug
            readTimeInMinutes
            coverImage { url }
            publishedAt
            tags { name }
          }
        }
      }
    }
  }
`;

// ─── STATIC DATA ─────────────────────────────────────────────────────
const LINKEDIN_POSTS = [
  {
    id: '7457318418610917376',
    url: 'https://www.linkedin.com/feed/update/urn:li:activity:7457318418610917376/',
    title: '🎉 Celebrating 1 Year at HotWax Systems!',
    excerpt: 'One year ago I joined HotWax Systems as a Software Engineer. Reflecting on the journey from mastering OFBiz internals to architecting data pipelines.',
    date: 'April 2026',
    emoji: '🚀',
    accentColor: '#0077b5',
  },
  {
    id: '7330335977908912129',
    url: 'https://www.linkedin.com/feed/update/urn:li:activity:7330335977908912129/',
    title: '⚙️ Deep Dive into Enterprise Data Orchestration',
    excerpt: 'Breaking down how we architected a multi-threaded CSV import engine that handles 500k+ product records with zero data loss.',
    date: 'March 2026',
    emoji: '🏗️',
    accentColor: '#ffd700',
  },
  {
    id: '7315823381319163908',
    title: '🚀 Scaling Operations with Data',
    date: 'February 2026',
  },
  {
    id: '7256941406227742720',
    title: '🛠️ Platform Engineering Insights',
    date: 'January 2026',
  },
  {
    id: '7118182686703128576',
    title: '📊 Data Visualization Milestones',
    date: 'December 2025',
  },
  {
    id: '7115720255670222848',
    title: '🤝 Collaboration in Tech',
    date: 'November 2025',
  },
  {
    id: '7115396441308618752',
    title: '⚙️ Systems Architecture',
    date: 'October 2025',
  },
  {
    id: '7115278544884133889',
    title: '🌟 Engineering Leadership',
    date: 'September 2025',
  },
  {
    id: '7114993182542589952',
    title: '📈 Product Growth Journey',
    date: 'August 2025',
  },
];


const GITHUB_REPOS = [
  {
    id: 'Dynamic-Docs',
    apiOwner: 'yash-verma5',
    name: 'Dynamic-Docs',
    description: 'The engine behind this documentation site — built with Docusaurus, custom React components, and live Hashnode/GitHub API integrations.',
    url: 'https://github.com/yash-verma5/Dynamic-Docs',
    language: 'JavaScript',
    color: '#f7df1e',
    icon: '📚',
  },
  {
    id: 'GreenMart',
    apiOwner: 'D6-GreenMart',
    name: 'GreenMart',
    description: 'Full-stack e-commerce platform — React + Redux storefront with real-time cart, backed by a Java/Spring Boot REST API serving dynamic product catalogs and category mappings.',
    url: 'https://github.com/D6-GreenMart',
    language: 'Java',
    color: '#3fb950',
    icon: '🛒',
  },
  {
    id: 'HouseSquare',
    apiOwner: 'yash-verma5',
    name: 'HouseSquare',
    description: 'Real Estate SPA — React + React Router with Google OAuth, Firestore real-time listings, and custom middleware for secure authentication and interactive dashboards.',
    url: 'https://github.com/yash-verma5/HouseSquare',
    language: 'JavaScript',
    color: '#58a6ff',
    icon: '🏠',
  },
];

// ─── COMPONENTS ───────────────────────────────────────────────────────

function HashnodeCard({ post, isFeatured }) {
  const date = new Date(post.publishedAt).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
  const href = `https://yashv521.hashnode.dev/${post.slug}`;

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`${styles.articleCard} ${isFeatured ? styles.featuredCard : ''}`}>
      {post.coverImage?.url && (
        <div className={styles.coverImage}>
          <img src={post.coverImage.url} alt={post.title} loading="lazy" />
          {isFeatured && <span className={styles.featuredBadge}>✦ Featured</span>}
        </div>
      )}
      <div className={styles.articleBody}>
        {post.tags?.length > 0 && (
          <div className={styles.tagRow}>
            {post.tags.slice(0, 3).map(tag => (
              <span key={tag.name} className={styles.tag}>
                <Hash size={10} /> {tag.name}
              </span>
            ))}
          </div>
        )}
        <h3 className={styles.articleTitle}>{post.title}</h3>
        <p className={styles.articleExcerpt}>{post.brief}</p>
        <div className={styles.articleMeta}>
          <span className={styles.metaItem}><Calendar size={13} /> {date}</span>
          {post.readTimeInMinutes && (
            <span className={styles.metaItem}><BookOpen size={13} /> {post.readTimeInMinutes} min read</span>
          )}
          <span className={styles.readMore}>Read Article <ArrowRight size={13} /></span>
        </div>
      </div>
    </a>
  );
}

function LinkedInCard({ post, isFavorite }) {
  return (
    <div className={styles.linkedinSlide}>
      <div className={styles.linkedinEmbedContainer}>
        {isFavorite && <div className={styles.featuredBadge} style={{ background: 'linear-gradient(135deg, #ffd700, #ff8c00)', color: '#000', left: '10px', top: '10px' }}>★ YASH'S FAV #5</div>}
        <iframe 
          src={`https://www.linkedin.com/embed/feed/update/urn:li:activity:${post.id}`} 
          height="550" 
          width="100%" 
          frameBorder="0" 
          allowFullScreen="" 
          title="Embedded LinkedIn post"
          className={styles.linkedinIframe}
        ></iframe>
      </div>
    </div>
  );
}

function LinkedInCarousel({ posts }) {
  const scrollRef = React.useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  const checkScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 10);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
      
      // Calculate active index based on scroll position
      const index = Math.round(scrollLeft / (clientWidth / (clientWidth > 996 ? 2 : 1)));
      setActiveIndex(index);
    }
  };

  useEffect(() => {
    const ref = scrollRef.current;
    if (ref) {
      ref.addEventListener('scroll', checkScroll);
      checkScroll();
      return () => ref.removeEventListener('scroll', checkScroll);
    }
  }, []);

  const scroll = (direction) => {
    if (scrollRef.current) {
      const scrollAmount = scrollRef.current.clientWidth * 0.8;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const scrollTo = (index) => {
    if (scrollRef.current) {
      const { clientWidth } = scrollRef.current;
      const itemWidth = clientWidth > 996 ? (clientWidth / 2) : clientWidth;
      scrollRef.current.scrollTo({
        left: index * itemWidth,
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className={styles.carouselWrapper}>
      <div className={styles.carouselContainer}>
        {canScrollLeft && (
          <button 
            className={`${styles.carouselBtn} ${styles.left}`} 
            onClick={() => scroll('left')}
            aria-label="Previous Post"
          >
            <ChevronLeft size={28} />
          </button>
        )}
        
        <div className={styles.carouselScroll} ref={scrollRef}>
          {posts.map((post, i) => (
            <LinkedInCard key={i} post={post} isFavorite={i === 4} />
          ))}
        </div>

        {canScrollRight && (
          <button 
            className={`${styles.carouselBtn} ${styles.right}`} 
            onClick={() => scroll('right')}
            aria-label="Next Post"
          >
            <ChevronRight size={28} />
          </button>
        )}
      </div>

      <div className={styles.carouselIndicators}>
        {posts.map((_, i) => (
          // Only show dots for possible scroll positions (every 2 on desktop, every 1 on mobile)
          <div 
            key={i} 
            className={`${styles.dot} ${activeIndex === i ? styles.active : ''}`}
            onClick={() => scrollTo(i)}
          />
        ))}
      </div>
    </div>
  );
}


function GitHubCard({ repo }) {
  return (
    <a href={repo.url} target="_blank" rel="noopener noreferrer" className={styles.githubCard}>
      <div className={styles.githubHeader}>
        <span className={styles.repoIcon}>{repo.icon}</span>
        <Terminal size={20} className={styles.githubIcon} />
      </div>
      <h3 className={styles.repoName}>{repo.name}</h3>
      <p className={styles.repoDescription}>{repo.description}</p>
      <div className={styles.repoFooter}>
        <span className={styles.repoLanguage} style={{ '--lang-color': repo.color }}>
          <span className={styles.langDot} /> {repo.language}
        </span>
        <div className={styles.repoStats}>
          <span><Star size={13} /> {repo.stars}</span>
          <span><GitFork size={13} /> {repo.forks}</span>
        </div>
      </div>
    </a>
  );
}

function SectionHeader({ title, subtitle, link, linkLabel }) {
  return (
    <div className={styles.sectionHeader}>
      <div>
        <h2 className={styles.sectionTitle}>{title}</h2>
        {subtitle && <p className={styles.sectionSubtitle}>{subtitle}</p>}
      </div>
      {link && (
        <a href={link} target="_blank" rel="noopener noreferrer" className={styles.viewAll}>
          {linkLabel} <ExternalLink size={14} />
        </a>
      )}
    </div>
  );
}

// ─── PAGE ─────────────────────────────────────────────────────────────
export default function BlogPage() {
  const [posts, setPosts] = useState([]);
  const [githubData, setGithubData] = useState(GITHUB_REPOS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    // Fetch Hashnode Posts
    const fetchHashnode = fetch(HASHNODE_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: QUERY }),
    }).then(res => res.json());

    // Fetch GitHub Repo Stats (each repo can have a different owner)
    const fetchGitHub = Promise.all(
      GITHUB_REPOS.map(repo =>
        fetch(`https://api.github.com/repos/${repo.apiOwner}/${repo.id}`)
          .then(res => res.ok ? res.json() : null)
          .catch(() => null)
      )
    );

    Promise.all([fetchHashnode, fetchGitHub])
      .then(([hashnodeRes, githubRes]) => {
        // Handle Hashnode
        if (hashnodeRes?.data?.publication?.posts?.edges) {
          setPosts(hashnodeRes.data.publication.posts.edges.map(e => e.node));
        } else {
          setError(true);
        }

        // Handle GitHub
        if (githubRes) {
          const updatedRepos = GITHUB_REPOS.map((repo, index) => {
            const liveData = githubRes[index];
            if (liveData) {
              return {
                ...repo,
                stars: liveData.stargazers_count,
                forks: liveData.forks_count,
              };
            }
            return repo;
          });
          setGithubData(updatedRepos);
        }
        
        setLoading(false);
      })
      .catch(() => { setError(true); setLoading(false); });
  }, []);

  const featured = posts[0];
  const rest = posts.slice(1);

  return (
    <Layout title="Blog & Socials — Yash Verma" description="Latest articles, LinkedIn updates, and open-source work by Yash Verma.">
      <main className={styles.blogMain}>

        {/* ── HERO ── */}
        <section className={styles.hero}>
          <div className={styles.heroBg} />
          <div className={styles.container}>
            <div className={styles.heroEyebrow}>
              <span className={styles.heroTag}>Engineering + Insights</span>
            </div>
            <h1 className={styles.heroTitle}>
              Ideas Worth <span className={styles.gold}>Writing About</span>
            </h1>
            <p className={styles.heroSubtitle}>
              Deep-dives into enterprise data architecture, OFBiz internals, and the craft of building scalable systems.
            </p>
            <div className={styles.heroCtas}>
              <a href="https://yashv521.hashnode.dev/" target="_blank" rel="noopener noreferrer" className={styles.primaryCta}>
                All Articles <ArrowRight size={16} />
              </a>
              <a href="https://www.linkedin.com/in/yash-verma-hotwax/" target="_blank" rel="noopener noreferrer" className={styles.secondaryCta}>
                <Users size={16} /> Follow on LinkedIn
              </a>
            </div>
          </div>
        </section>

        <div className={styles.container}>
          <div style={{ marginTop: '-20px', marginBottom: '40px' }}>
            <HomeBackButton />
          </div>

          {/* ── HASHNODE ARTICLES ── */}
          <section className={styles.section}>
            <SectionHeader
              title="Latest Articles"
              subtitle="Published on Hashnode — technical deep-dives and engineering insights."
              link="https://yashv521.hashnode.dev/"
              linkLabel="All on Hashnode"
            />

            {loading && (
              <div className={styles.loadingState}>
                <Loader2 size={32} className={styles.spinner} />
                <span>Fetching latest insights from Hashnode...</span>
              </div>
            )}

            {error && !loading && (
              <div className={styles.errorState}>
                <p>Couldn't load articles. <a href="https://yashv521.hashnode.dev/" target="_blank" rel="noopener noreferrer">Visit Hashnode directly →</a></p>
              </div>
            )}

            {!loading && !error && (
              <>
                {featured && (
                  <div className={styles.featuredWrapper}>
                    <HashnodeCard post={featured} isFeatured />
                  </div>
                )}
                {rest.length > 0 && (
                  <div className={styles.articlesGrid}>
                    {rest.map((post, i) => (
                      <HashnodeCard key={i} post={post} />
                    ))}
                  </div>
                )}
              </>
            )}
          </section>


          {/* ── LINKEDIN ── */}
          <section className={styles.section}>
            <SectionHeader
              title="LinkedIn Updates"
              subtitle="Sharing engineering learnings and milestones."
              link="https://www.linkedin.com/in/yash-verma-hotwax/"
              linkLabel="View Profile"
            />
            <LinkedInCarousel posts={LINKEDIN_POSTS} />

          </section>

          {/* ── OPEN SOURCE ── */}
          <section className={styles.section}>
            <SectionHeader
              title="Open Source"
              subtitle="Projects I've built — from full-stack platforms to real estate SPAs."
              link="https://github.com/yash-verma5"
              linkLabel="GitHub Profile"
            />
            <div className={styles.githubGrid}>
              {githubData.map((repo, i) => (
                <GitHubCard key={i} repo={repo} />
              ))}
            </div>
          </section>


        </div>
      </main>
    </Layout>
  );
}
