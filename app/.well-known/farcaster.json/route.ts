export async function GET() {
  const URL = process.env.NEXT_PUBLIC_URL;

  return Response.json({
    accountAssociation: {
      header: process.env.FARCASTER_HEADER,
      payload: process.env.FARCASTER_PAYLOAD,
      signature: process.env.FARCASTER_SIGNATURE,
    },
    frame: {
      version: process.env.NEXT_PUBLIC_VERSION,
      name: "EON: Effortless Impact",
      homeUrl: URL,
      iconUrl: process.env.NEXT_PUBLIC_ICON_URL,
      imageUrl: process.env.NEXT_PUBLIC_IMAGE_URL,
      buttonTitle: `Begin`,
      splashImageUrl: process.env.NEXT_PUBLIC_SPLASH_IMAGE_URL,
      splashBackgroundColor: `#${process.env.NEXT_PUBLIC_SPLASH_BACKGROUND_COLOR}`,
      webhookUrl: `https://api.neynar.com/f/app/eae85705-7db9-4c2c-9887-163266c68bb3/event`,
      primaryCategory: `utility`,
      subtitle: `Simple, easy charitable giving`,
      description: `Auto-donate a portion of your on-chain earnings to charity and watch how fast microtransactions add up to make a big difference.`,
      tagline: `Impact, the easy way`,
      tags: ["charity", "philanthropy", "impact", "give", "social"],
      ogTitle: "EON - Effortless Impact",
      ogDescription: "Auto-donate a small portion of your on-chain earnings and watch it add up to a big difference.",
      ogImageUrl: process.env.NEXT_PUBLIC_HEADER_IMAGE_URL,
      heroImageUrl: process.env.NEXT_PUBLIC_HEADER_IMAGE_URL,
    },
  });
}
