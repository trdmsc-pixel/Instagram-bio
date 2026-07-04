'use client';

import { useState, useEffect } from 'react';
import { GITHUB_USERNAME as DEFAULT_USERNAME, GITHUB_REPO as DEFAULT_REPO } from '../config';

export default function Admin() {
  // Auth state
  const [username, setUsername] = useState('');
  const [repo, setRepo] = useState('');
  const [pat, setPat] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);

  // App Data state
  const [bioTitle, setBioTitle] = useState('');
  const [bioDesc, setBioDesc] = useState('');
  const [bioAvatar, setBioAvatar] = useState('');
  const [products, setProducts] = useState([]);

  // Form inputs for new / edited product
  const [prodUrl, setProdUrl] = useState('');
  const [prodName, setProdName] = useState('');
  const [prodThumbnail, setProdThumbnail] = useState('');
  const [editingId, setEditingId] = useState(null); // id of product being edited, null if adding new

  // UI state
  const [isFetchingUrl, setIsFetchingUrl] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const [uploadProgress, setUploadProgress] = useState('');

  // Load saved credentials on mount
  useEffect(() => {
    const savedUsername = localStorage.getItem('ib_github_username') || DEFAULT_USERNAME;
    const savedRepo = localStorage.getItem('ib_github_repo') || DEFAULT_REPO;
    const savedPat = localStorage.getItem('ib_github_pat') || '';

    setUsername(savedUsername);
    setRepo(savedRepo);
    setPat(savedPat);

    // If PAT is already present, try to fetch current data to verify auth
    if (savedPat) {
      loadRepoData(savedUsername, savedRepo, savedPat);
    }
  }, []);

  const loadRepoData = async (user, rp, token) => {
    try {
      const res = await fetch(`https://api.github.com/repos/${user}/${rp}/contents/public/data.json`, {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
        }
      });

      if (res.ok) {
        const json = await res.json();
        // GitHub API content is base64 encoded
        const decodedContent = decodeURIComponent(escape(atob(json.content)));
        const data = JSON.parse(decodedContent);

        setBioTitle(data.bio?.title || '');
        setBioDesc(data.bio?.description || '');
        setBioAvatar(data.bio?.avatar || '');
        setProducts(data.products || []);
        setIsAuthorized(true);
        setStatusMsg({ type: 'success', text: 'Connected to GitHub successfully!' });
      } else if (res.status === 404) {
        // public/data.json doesn't exist, we can initialize it
        setBioTitle('sham-decoded');
        setBioDesc('Welcome to my decoded space!');
        setBioAvatar('https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=150&auto=format&fit=crop');
        setProducts([]);
        setIsAuthorized(true);
        setStatusMsg({ type: 'success', text: 'Connected! data.json will be initialized on first save.' });
      } else {
        localStorage.removeItem('ib_github_pat');
        setStatusMsg({ type: 'error', text: 'Failed to connect. Please check your token and repository.' });
      }
    } catch (err) {
      console.error(err);
      setStatusMsg({ type: 'error', text: 'Error connecting to GitHub. Check network and credentials.' });
    }
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (!username || !repo || !pat) {
      setStatusMsg({ type: 'error', text: 'All fields are required.' });
      return;
    }
    localStorage.setItem('ib_github_username', username);
    localStorage.setItem('ib_github_repo', repo);
    localStorage.setItem('ib_github_pat', pat);
    
    setStatusMsg({ type: 'info', text: 'Connecting...' });
    loadRepoData(username, repo, pat);
  };

  const handleLogout = () => {
    localStorage.removeItem('ib_github_pat');
    setPat('');
    setIsAuthorized(false);
    setStatusMsg({ type: 'info', text: 'Logged out.' });
  };

  // Helper to commit a file to GitHub
  const commitToGitHub = async (path, contentBase64, commitMessage) => {
    // 1. Get SHA if file exists
    let sha = '';
    try {
      const getRes = await fetch(`https://api.github.com/repos/${username}/${repo}/contents/${path}`, {
        headers: {
          'Authorization': `token ${pat}`,
          'Accept': 'application/vnd.github.v3+json',
        }
      });
      if (getRes.ok) {
        const getJson = await getRes.json();
        sha = getJson.sha;
      }
    } catch (e) {
      // Ignored if file doesn't exist
    }

    // 2. Put file
    const putBody = {
      message: commitMessage,
      content: contentBase64,
    };
    if (sha) {
      putBody.sha = sha;
    }

    const putRes = await fetch(`https://api.github.com/repos/${username}/${repo}/contents/${path}`, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${pat}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json',
      },
      body: JSON.stringify(putBody)
    });

    if (!putRes.ok) {
      const errJson = await putRes.json();
      throw new Error(errJson.message || 'GitHub API commit failed');
    }

    return true;
  };

  // Auto fetch metadata from product URL
  const fetchProductMetadata = async () => {
    if (!prodUrl) {
      setStatusMsg({ type: 'error', text: 'Please enter a product URL first.' });
      return;
    }

    setIsFetchingUrl(true);
    setStatusMsg({ type: 'info', text: 'Fetching product details...' });

    try {
      const res = await fetch(`/api/fetch-metadata?url=${encodeURIComponent(prodUrl)}`);
      const json = await res.json();

      if (res.ok) {
        setProdName(json.title || '');
        setProdThumbnail(json.image || '');
        setStatusMsg({ type: 'success', text: 'Product details fetched successfully!' });
      } else {
        setStatusMsg({ type: 'error', text: json.error || 'Failed to fetch details from URL.' });
      }
    } catch (err) {
      console.error(err);
      setStatusMsg({ type: 'error', text: 'Error calling fetch API. Make sure URL is correct.' });
    } finally {
      setIsFetchingUrl(false);
    }
  };

  // Upload an image manually to GitHub
  const handleImageUpload = async (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadProgress('Uploading image...');
    
    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64Content = reader.result.split(',')[1];
        const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        const path = `public/uploads/${filename}`;
        
        await commitToGitHub(path, base64Content, `Upload image: ${filename}`);

        // Construct raw github content URL for immediate display
        const rawUrl = `https://raw.githubusercontent.com/${username}/${repo}/main/${path}`;
        
        if (type === 'avatar') {
          setBioAvatar(rawUrl);
          setStatusMsg({ type: 'success', text: 'Avatar uploaded successfully!' });
        } else {
          setProdThumbnail(rawUrl);
          setStatusMsg({ type: 'success', text: 'Product thumbnail uploaded successfully!' });
        }
        setUploadProgress('');
      };
    } catch (err) {
      console.error(err);
      setStatusMsg({ type: 'error', text: 'Failed to upload image to repository.' });
      setUploadProgress('');
    }
  };

  // Add or Update Product in local state list
  const handleAddOrUpdateProduct = (e) => {
    e.preventDefault();
    if (!prodName || !prodUrl) {
      setStatusMsg({ type: 'error', text: 'Product Name and URL are required.' });
      return;
    }

    if (editingId) {
      // Editing existing
      setProducts(products.map(p => p.id === editingId ? { ...p, name: prodName, url: prodUrl, thumbnail: prodThumbnail } : p));
      setEditingId(null);
      setStatusMsg({ type: 'success', text: 'Product updated locally. Save changes to publish.' });
    } else {
      // Adding new
      const newProduct = {
        id: Date.now().toString(),
        name: prodName,
        url: prodUrl,
        thumbnail: prodThumbnail
      };
      setProducts([...products, newProduct]);
      setStatusMsg({ type: 'success', text: 'Product added locally. Save changes to publish.' });
    }

    // Reset inputs
    setProdUrl('');
    setProdName('');
    setProdThumbnail('');
  };

  // Delete product from local list
  const handleDeleteProduct = (id) => {
    setProducts(products.filter(p => p.id !== id));
    setStatusMsg({ type: 'info', text: 'Product removed locally. Save changes to publish.' });
  };

  // Set inputs to edit a product
  const handleEditProductClick = (product) => {
    setEditingId(product.id);
    setProdUrl(product.url);
    setProdName(product.name);
    setProdThumbnail(product.thumbnail);
  };

  // Commit complete data.json to GitHub
  const handleSaveChanges = async () => {
    setIsSaving(true);
    setStatusMsg({ type: 'info', text: 'Saving changes to GitHub...' });

    try {
      const dataToSave = {
        bio: {
          title: bioTitle,
          avatar: bioAvatar,
          description: bioDesc
        },
        products: products
      };

      const jsonStr = JSON.stringify(dataToSave, null, 2);
      // Handle non-ASCII characters in base64 encoding
      const utf8Bytes = new TextEncoder().encode(jsonStr);
      let binaryStr = '';
      utf8Bytes.forEach((byte) => {
        binaryStr += String.fromCharCode(byte);
      });
      const base64Content = btoa(binaryStr);

      await commitToGitHub('public/data.json', base64Content, 'Update bio data config');
      setStatusMsg({ type: 'success', text: 'All changes saved and pushed to GitHub! They will update instantly.' });
    } catch (err) {
      console.error(err);
      setStatusMsg({ type: 'error', text: `Failed to save: ${err.message}` });
    } finally {
      setIsSaving(false);
    }
  };

  // Render auth/login screen if not authorized
  if (!isAuthorized) {
    return (
      <main className="mobile-frame animate-fade-in" style={{ justifyContent: 'center' }}>
        <div className="bg-blobs">
          <div className="blob blob-1"></div>
          <div className="blob blob-2"></div>
          <div className="blob blob-3"></div>
        </div>

        <div className="glass-container auth-card animate-slide-up" style={{ padding: '30px 24px' }}>
          <h2 style={{ textAlign: 'center', marginBottom: '8px', fontSize: '24px', fontWeight: '700' }}>sham-decoded</h2>
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14.5px', marginBottom: '24px' }}>
            Bio Control Center
          </p>

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>GitHub Username</label>
              <input 
                type="text" 
                className="glass-input" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. trdmsc-pixel"
                required
              />
            </div>

            <div className="form-group">
              <label>GitHub Repository</label>
              <input 
                type="text" 
                className="glass-input" 
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
                placeholder="e.g. Instagram-bio"
                required
              />
            </div>

            <div className="form-group">
              <label>Personal Access Token (PAT)</label>
              <input 
                type="password" 
                className="glass-input" 
                value={pat}
                onChange={(e) => setPat(e.target.value)}
                placeholder="ghp_..."
                required
              />
              <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px', lineHeight: '1.4' }}>
                Needs repo access to write to public/data.json and public/uploads/. Credentials reside safely in localStorage.
              </span>
            </div>

            {statusMsg.text && (
              <div className={`status-badge status-badge-${statusMsg.type}`} style={{ margin: '14px 0', padding: '10px 14px', borderRadius: '10px' }}>
                {statusMsg.text}
              </div>
            )}

            <button type="submit" className="glass-btn glass-btn-primary" style={{ width: '100%', marginTop: '10px' }}>
              Connect Dashboard
            </button>
          </form>
        </div>
      </main>
    );
  }

  // Render Authorized Admin Control Center
  return (
    <main className="mobile-frame animate-fade-in" style={{ paddingBottom: '100px' }}>
      <div className="bg-blobs">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
      </div>

      {/* Header */}
      <header className="admin-header">
        <div>
          <h2>Control Center</h2>
          <span style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>@{username}/{repo}</span>
        </div>
        <button className="glass-btn" onClick={handleLogout} style={{ padding: '8px 12px', fontSize: '13px' }}>
          Disconnect
        </button>
      </header>

      {statusMsg.text && (
        <div className={`status-badge status-badge-${statusMsg.type}`} style={{ margin: '0 0 20px 0', padding: '10px 14px', borderRadius: '10px' }}>
          {statusMsg.text}
        </div>
      )}

      {/* Profile Bio Config */}
      <section className="glass-container admin-section">
        <h3>Landing Bio Config</h3>
        
        <div className="form-group">
          <label>Profile Title</label>
          <input 
            type="text" 
            className="glass-input"
            value={bioTitle}
            onChange={(e) => setBioTitle(e.target.value)}
            placeholder="Title displayed at top"
          />
        </div>

        <div className="form-group">
          <label>Bio Description</label>
          <textarea 
            className="glass-input"
            value={bioDesc}
            onChange={(e) => setBioDesc(e.target.value)}
            placeholder="Brief welcoming bio description"
            rows="3"
            style={{ resize: 'none' }}
          />
        </div>

        <div className="form-group">
          <label>Avatar Image URL</label>
          <input 
            type="text" 
            className="glass-input"
            value={bioAvatar}
            onChange={(e) => setBioAvatar(e.target.value)}
            placeholder="Avatar URL or upload below"
          />
        </div>

        <div className="form-group">
          <label>Upload New Avatar</label>
          <input 
            type="file" 
            accept="image/*"
            className="glass-input"
            onChange={(e) => handleImageUpload(e, 'avatar')}
            style={{ padding: '10px' }}
          />
          {uploadProgress && <span style={{ fontSize: '12px', color: 'var(--accent-purple)' }}>{uploadProgress}</span>}
        </div>
      </section>

      {/* Product Tagging Form */}
      <section className="glass-container admin-section">
        <h3>{editingId ? 'Edit Tagged Product' : 'Tag New Product'}</h3>
        
        <div className="form-group">
          <label>Product URL</label>
          <div className="input-row">
            <input 
              type="url" 
              className="glass-input"
              value={prodUrl}
              onChange={(e) => setProdUrl(e.target.value)}
              placeholder="Paste any product website link"
            />
            <button 
              type="button" 
              className="glass-btn" 
              onClick={fetchProductMetadata} 
              disabled={isFetchingUrl}
              style={{ flexShrink: 0, padding: '10px 14px' }}
            >
              {isFetchingUrl ? '...' : 'Fetch'}
            </button>
          </div>
        </div>

        <div className="form-group">
          <label>Product Name</label>
          <input 
            type="text" 
            className="glass-input"
            value={prodName}
            onChange={(e) => setProdName(e.target.value)}
            placeholder="Product display title"
          />
        </div>

        <div className="form-group">
          <label>Thumbnail Image URL</label>
          <input 
            type="text" 
            className="glass-input"
            value={prodThumbnail}
            onChange={(e) => setProdThumbnail(e.target.value)}
            placeholder="Thumbnail URL or upload below"
          />
        </div>

        <div className="form-group">
          <label>Upload Thumbnail File</label>
          <input 
            type="file" 
            accept="image/*"
            className="glass-input"
            onChange={(e) => handleImageUpload(e, 'product')}
            style={{ padding: '10px' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
          <button onClick={handleAddOrUpdateProduct} className="glass-btn glass-btn-primary" style={{ flexGrow: 1 }}>
            {editingId ? 'Update Product' : 'Add to List'}
          </button>
          {editingId && (
            <button 
              type="button" 
              onClick={() => {
                setEditingId(null);
                setProdUrl('');
                setProdName('');
                setProdThumbnail('');
              }} 
              className="glass-btn"
            >
              Cancel
            </button>
          )}
        </div>
      </section>

      {/* Tagged Products list */}
      <section className="glass-container admin-section">
        <h3>Active Tagged Products ({products.length})</h3>
        
        {products.length === 0 ? (
          <p style={{ color: 'var(--text-tertiary)', textAlign: 'center', padding: '20px 0', fontSize: '14.5px' }}>
            No products tagged yet. Add products using the form above.
          </p>
        ) : (
          <div>
            {products.map((p) => (
              <div key={p.id} className="product-item">
                <img 
                  src={p.thumbnail || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=100&auto=format&fit=crop'} 
                  alt={p.name}
                  onError={(e) => {
                    e.currentTarget.src = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=100&auto=format&fit=crop';
                  }}
                />
                <div className="product-item-details">
                  <h4>{p.name}</h4>
                  <p style={{ textTransform: 'none' }}>{p.url}</p>
                </div>
                <div className="product-actions">
                  <button 
                    onClick={() => handleEditProductClick(p)} 
                    className="glass-btn" 
                    style={{ padding: '8px 10px', borderRadius: '8px', fontSize: '12px' }}
                  >
                    Edit
                  </button>
                  <button 
                    onClick={() => handleDeleteProduct(p.id)} 
                    className="glass-btn glass-btn-danger" 
                    style={{ padding: '8px 10px', borderRadius: '8px', fontSize: '12px' }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Floating Save Bar */}
      <div 
        style={{ 
          position: 'fixed', 
          bottom: '20px', 
          left: '50%', 
          transform: 'translateX(-50%)', 
          width: 'calc(100% - 40px)', 
          maxWidth: '440px',
          zIndex: 10
        }}
      >
        <button 
          onClick={handleSaveChanges} 
          disabled={isSaving}
          className="glass-btn glass-btn-primary" 
          style={{ 
            width: '100%', 
            padding: '16px', 
            borderRadius: '16px',
            fontSize: '16px',
            boxShadow: '0 10px 30px rgba(139, 92, 246, 0.4)'
          }}
        >
          {isSaving ? 'Saving Changes to GitHub...' : 'Publish Changes Now'}
        </button>
      </div>
    </main>
  );
}
