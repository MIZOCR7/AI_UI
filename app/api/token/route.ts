import { NextResponse } from 'next/server';
import {
  AccessToken,
  type AccessTokenOptions,
  RoomConfiguration,
  type VideoGrant,
} from 'livekit-server-sdk';

type ConnectionDetails = {
  serverUrl: string;
  roomName: string;
  participantName: string;
  participantToken: string;
};

// Don't cache results
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const livekitUrl = process.env.LIVEKIT_URL;

    if (!livekitUrl) {
      return new NextResponse('LIVEKIT_URL is not defined in environment variables', {
        status: 500,
      });
    }
    if (!apiKey) {
      return new NextResponse('LIVEKIT_API_KEY is not defined in environment variables', {
        status: 500,
      });
    }
    if (!apiSecret) {
      return new NextResponse('LIVEKIT_API_SECRET is not defined in environment variables', {
        status: 500,
      });
    }

    // Parse room config from request body.
    let roomConfig: RoomConfiguration | undefined;
    try {
      const body = await req.json();
      roomConfig = body?.room_config
        ? RoomConfiguration.fromJson(body.room_config, { ignoreUnknownFields: true })
        : new RoomConfiguration();
    } catch {
      roomConfig = new RoomConfiguration();
    }

    // Generate participant token
    const participantName = 'user';
    const participantIdentity = `voice_assistant_user_${Math.floor(Math.random() * 10_000)}`;
    const roomName = `voice_assistant_room_${Math.floor(Math.random() * 10_000)}`;

    const participantToken = await createParticipantToken(
      { identity: participantIdentity, name: participantName },
      roomName,
      roomConfig,
      apiKey,
      apiSecret
    );

    // Return connection details
    const data: ConnectionDetails = {
      serverUrl: livekitUrl,
      roomName,
      participantName,
      participantToken,
    };
    const headers = new Headers({
      'Cache-Control': 'no-store',
    });
    return NextResponse.json(data, { headers });
  } catch (error) {
    console.error('Error generating token:', error);
    const message = error instanceof Error ? error.message : 'Unknown error generating token';
    return new NextResponse(message, { status: 500 });
  }
}

function createParticipantToken(
  userInfo: AccessTokenOptions,
  roomName: string,
  roomConfig: RoomConfiguration | undefined,
  apiKey: string,
  apiSecret: string
): Promise<string> {
  const at = new AccessToken(apiKey, apiSecret, {
    ...userInfo,
    ttl: '15m',
  });
  const grant: VideoGrant = {
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canPublishData: true,
    canSubscribe: true,
  };
  at.addGrant(grant);

  if (roomConfig) {
    at.roomConfig = roomConfig;
  }

  return at.toJwt();
}
