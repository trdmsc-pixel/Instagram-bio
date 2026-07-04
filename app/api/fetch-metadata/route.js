import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
  }

  try {
    // Validate targetUrl format
    const parsedUrl = new URL(targetUrl);
    
    // Fetch target URL content
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      next: { revalidate: 0 } // Disable next.js caching
    });

    if (!response.ok) {
      return NextResponse.json({ error: `Failed to fetch URL: HTTP ${response.status}` }, { status: 400 });
    }

    const html = await response.text();

    // Parse metadata using regex
    // 1. Try OG Image
    let imageUrl = '';
    const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                        html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    if (ogImageMatch && ogImageMatch[1]) {
      imageUrl = ogImageMatch[1];
    } else {
      // 2. Try Twitter image fallback
      const twitterImageMatch = html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i) ||
                               html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i);
      if (twitterImageMatch && twitterImageMatch[1]) {
        imageUrl = twitterImageMatch[1];
      } else {
        // 3. Try standard favicon link
        const iconMatch = html.match(/<link[^>]*rel=["'](?:apple-touch-icon|icon|shortcut icon)["'][^>]*href=["']([^"']+)["']/i);
        if (iconMatch && iconMatch[1]) {
          imageUrl = iconMatch[1];
        }
      }
    }

    // Resolve relative image URLs
    if (imageUrl && !imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
      if (imageUrl.startsWith('//')) {
        imageUrl = 'https:' + imageUrl;
      } else if (imageUrl.startsWith('/')) {
        imageUrl = `${parsedUrl.protocol}//${parsedUrl.host}${imageUrl}`;
      } else {
        imageUrl = `${parsedUrl.protocol}//${parsedUrl.host}/${imageUrl}`;
      }
    }

    // 4. Try OG Title, fallback to page <title>
    let title = '';
    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
                        html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
    if (ogTitleMatch && ogTitleMatch[1]) {
      title = ogTitleMatch[1];
    } else {
      const titleTagMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if (titleTagMatch && titleTagMatch[1]) {
        title = titleTagMatch[1].trim();
      }
    }

    // Clean up title HTML entities
    if (title) {
      title = title
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&rsquo;/g, "'")
        .replace(/&ndash;/g, '-')
        .replace(/&mdash;/g, '-');
    }

    return NextResponse.json({
      title: title || 'Product Link',
      image: imageUrl || '',
    });
  } catch (error) {
    return NextResponse.json({ error: 'Invalid URL or failed to reach the server. Please check the address.' }, { status: 400 });
  }
}
