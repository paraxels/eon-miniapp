import { ImageResponse } from 'next/og';

export const runtime = 'edge';

// Base URL for API requests
const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';

export async function GET() {
  try {
    // Load both fonts
    let englishTowneFont: ArrayBuffer;
    let interFont: ArrayBuffer;
    let interFontBold: ArrayBuffer;
    try {
      // Load EnglishTowne font for the title
      const englishTowneFontResponse = await fetch(`${baseUrl}/fonts/EnglishTowne.ttf`);
      if (!englishTowneFontResponse.ok) throw new Error('Failed to load EnglishTowne font');
      englishTowneFont = await englishTowneFontResponse.arrayBuffer();
      
      // Load Inter font for the rest of the text
      const interFontResponse = await fetch(`${baseUrl}/fonts/Inter-Regular.ttf`);
      if (!interFontResponse.ok) throw new Error('Failed to load Inter font');
      interFont = await interFontResponse.arrayBuffer();

      // Load Inter font for the rest of the text
      const interFontResponseBold = await fetch(`${baseUrl}/fonts/Inter-Bold.ttf`);
      if (!interFontResponseBold.ok) throw new Error('Failed to load Inter font');
      interFontBold = await interFontResponseBold.arrayBuffer();
    } catch (error) {
      console.error('Error loading fonts:', error);
      return new Response('Failed to load fonts', { status: 500 });
    }
    
    // Fetch total donations
    const response = await fetch(`${baseUrl}/api/total-donations`);
    const data = await response.ok ? await response.json() : { totalDonated: 0, transactionCount: 0 };
    
    const totalDonated = data.totalDonated ? (data.totalDonated / 1000000).toFixed(2) : '0.00';
    const transactionCount = data.transactionCount || 0;

    return new ImageResponse(
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
            {/* Only the title uses EnglishTowne font */}
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
                textTransform: 'uppercase'
              }}
            >
              EON
            </h1>
            
            {/* All other text uses Inter font */}
            {/* <p style={{ 
              fontSize: 34, 
              color: '#666',
              margin: 0,
              marginBottom: '2rem',
              fontWeight: 300,
              fontFamily: 'Inter'
            }}>
              compound your impact for the longterm
            </p> */}
            
            <div style={{ 
              display: 'flex', 
              flexDirection: 'row',
              justifyContent: 'center', 
              alignItems: 'center', 
              gap: '0.5rem',
              marginBottom: '1rem',
              fontFamily: 'InterBold'
            }}>
              <span style={{ 
                fontSize: 45, 
                fontWeight: 800, 
                color: '#5FA578',
                fontFamily: 'InterBold'
              }}>
                ${totalDonated} raised
              </span>
              <div style={{ 
                width: '3px', 
                height: '40px', 
                backgroundColor: '#5FA578', 
                opacity: 0.3
              }}></div>
              <span style={{ 
                fontSize: 45, 
                fontWeight: 800, 
                color: '#5FA578',
                fontFamily: 'InterBold'
              }}>
                {transactionCount} {transactionCount === 1 ? 'donation' : 'donations'}
              </span>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        // Load both EnglishTowne and Inter fonts
        fonts: [
          {
            name: 'EnglishTowne',
            data: englishTowneFont,
            style: 'normal',
            weight: 400,
          },
          {
            name: 'Inter',
            data: interFont,
            style: 'normal',
            weight: 400,
          },
          {
            name: 'InterBold',
            data: interFontBold,
            style: 'normal',
            weight: 800,
          }
        ],
        headers: {
          'Cache-Control': 'public, immutable, no-transform, max-age=300',
        },
      }
    );
  } catch (error) {
    console.error('Error generating image:', error);
    return new Response('Error generating image', { status: 500 });
  }
}
