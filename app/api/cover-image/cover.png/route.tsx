import { ImageResponse } from 'next/og';

const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Load fonts
    const [englishTowneFont, interFont, interFontBold] = await Promise.all([
      fetch(`${baseUrl}/fonts/EnglishTowne.ttf`).then((res) => {
        if (!res.ok) throw new Error('Failed to load EnglishTowne font');
        return res.arrayBuffer();
      }),
      fetch(`${baseUrl}/fonts/Inter-Regular.ttf`).then((res) => {
        if (!res.ok) throw new Error('Failed to load Inter-Regular font');
        return res.arrayBuffer();
      }),
      fetch(`${baseUrl}/fonts/Inter-Bold.ttf`).then((res) => {
        if (!res.ok) throw new Error('Failed to load Inter-Bold font');
        return res.arrayBuffer();
      }),
    ]);

    // Fetch donation data
    const response = await fetch(`${baseUrl}/api/total-donations`);
    const data = response.ok ? await response.json() : { totalDonated: 0, transactionCount: 0 };

    const totalDonated = data.totalDonated ? (data.totalDonated / 1_000_000).toFixed(2) : '0.00';
    const transactionCount = data.transactionCount || 0;

    const image = new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            background: '#F7F6E7',
            width: '100%',
            height: '100%',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '2rem',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h1
              style={{
                fontSize: 220,
                fontWeight: 'bold',
                margin: 0,
                marginTop: '-1rem',
                marginBottom: '0.5rem',
                letterSpacing: '0.2em',
                color: '#5FA578',
                fontFamily: 'EnglishTowne',
                textTransform: 'uppercase',
              }}
            >
              EON
            </h1>

            <div
              style={{
                display: 'flex',
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                gap: '0.5rem',
                marginBottom: '1rem',
                fontFamily: 'InterBold',
              }}
            >
              <span
                style={{
                  fontSize: 45,
                  fontWeight: 800,
                  color: '#5FA578',
                  fontFamily: 'InterBold',
                }}
              >
                ${totalDonated} raised
              </span>
              <div
                style={{
                  width: '3px',
                  height: '40px',
                  backgroundColor: '#5FA578',
                  opacity: 0.3,
                }}
              ></div>
              <span
                style={{
                  fontSize: 45,
                  fontWeight: 800,
                  color: '#5FA578',
                  fontFamily: 'InterBold',
                }}
              >
                {transactionCount} {transactionCount === 1 ? 'donation' : 'donations'}
              </span>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        fonts: [
          { name: 'EnglishTowne', data: englishTowneFont, style: 'normal', weight: 400 },
          { name: 'Inter', data: interFont, style: 'normal', weight: 600 },
          { name: 'InterBold', data: interFontBold, style: 'normal', weight: 600 },
        ],
      }
    );

    return new Response(image.body, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, immutable, no-transform, max-age=300, s-maxage=300, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Error generating image:', error);
    return new Response('Error generating image', { status: 500 });
  }
}