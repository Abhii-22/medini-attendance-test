import {
  RekognitionClient,
  CreateCollectionCommand,
  DescribeCollectionCommand,
  DetectFacesCommand,
  IndexFacesCommand,
  SearchFacesByImageCommand,
  DeleteFacesCommand,
} from '@aws-sdk/client-rekognition';

/* ------------------------------------------------------------------ *
 *  CONFIG (all values come from .env)
 * ------------------------------------------------------------------ */
const REGION = process.env.AWS_REGION || 'ap-south-1';
const COLLECTION_ID = process.env.REKOGNITION_COLLECTION_ID || 'employee-faces';
// Minimum similarity (0-100) for a punch to be accepted. 90-95 is typical.
export const MATCH_THRESHOLD = Number(process.env.FACE_MATCH_THRESHOLD || 92);
// Two different employees must never share a face. Anything above this is a duplicate.
const DUPLICATE_THRESHOLD = 95;

// The SDK reads AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY from the environment automatically.
const client = new RekognitionClient({ region: REGION });

export type FaceStatus =
  | 'MATCH'
  | 'MISMATCH'
  | 'NO_FACE'
  | 'MULTIPLE_FACES'
  | 'LOW_QUALITY';

export interface FaceCheckResult {
  status: FaceStatus;
  similarity?: number;
  message: string;
}

/* ------------------------------------------------------------------ *
 *  HELPERS
 * ------------------------------------------------------------------ */

/** Converts "data:image/jpeg;base64,...." (or plain base64) into raw bytes. */
export function dataUriToBuffer(dataUri: string): Buffer {
  const base64 = dataUri.includes(',') ? (dataUri.split(',')[1] ?? '') : dataUri;
  return Buffer.from(base64, 'base64');
}

/** Rekognition ExternalImageId only allows [a-zA-Z0-9_.\-:] */
export function toExternalId(employeeId: string): string {
  return String(employeeId).trim().toUpperCase().replace(/[^a-zA-Z0-9_.\-:]/g, '_');
}

let collectionReady = false;

/** Creates the face collection the first time the server needs it. */
export async function ensureCollection(): Promise<void> {
  if (collectionReady) return;
  try {
    await client.send(new DescribeCollectionCommand({ CollectionId: COLLECTION_ID }));
  } catch (err: any) {
    if (err?.name === 'ResourceNotFoundException') {
      await client.send(new CreateCollectionCommand({ CollectionId: COLLECTION_ID }));
      console.log(`Rekognition collection "${COLLECTION_ID}" created in ${REGION}`);
    } else {
      throw err;
    }
  }
  collectionReady = true;
}

/* ------------------------------------------------------------------ *
 *  QUALITY GATE: exactly one clear, bright, sharp face
 * ------------------------------------------------------------------ */
export async function checkFaceQuality(image: Buffer): Promise<FaceCheckResult> {
  const res = await client.send(
    new DetectFacesCommand({ Image: { Bytes: image }, Attributes: ['DEFAULT'] }),
  );
  const faces = res.FaceDetails || [];

  if (faces.length === 0) {
    return { status: 'NO_FACE', message: 'No face detected. Look straight at the camera in good light.' };
  }
  if (faces.length > 1) {
    return { status: 'MULTIPLE_FACES', message: 'More than one face detected. Only you should be in the frame.' };
  }

  const face = faces[0];
  if (!face) {
    return { status: 'NO_FACE', message: 'No face detected. Look straight at the camera in good light.' };
  }
  const sharpness = face.Quality?.Sharpness ?? 100;
  const brightness = face.Quality?.Brightness ?? 100;
  const confidence = face.Confidence ?? 100;

  if (confidence < 90 || sharpness < 15 || brightness < 20) {
    return {
      status: 'LOW_QUALITY',
      message: 'Photo is too dark or blurry. Move to better light, hold still and try again.',
    };
  }
  return { status: 'MATCH', message: 'Quality OK' };
}

/* ------------------------------------------------------------------ *
 *  ENROLLMENT (admin)
 * ------------------------------------------------------------------ */
export interface EnrollResult {
  success: boolean;
  faceIds: string[];
  message: string;
}

/**
 * Indexes one or more photos for an employee.
 * Every photo must pass the quality gate and must not belong to another employee.
 */
export async function enrollFaces(employeeId: string, images: Buffer[]): Promise<EnrollResult> {
  await ensureCollection();
  const externalId = toExternalId(employeeId);
  const faceIds: string[] = [];

  try {
    for (const [i, image] of images.entries()) {
      const label = `Photo ${i + 1}`;

      const quality = await checkFaceQuality(image);
      if (quality.status !== 'MATCH') {
        throw new Error(`${label}: ${quality.message}`);
      }

      // Reject if this face is already enrolled under a DIFFERENT employee.
      try {
        const dup = await client.send(
          new SearchFacesByImageCommand({
            CollectionId: COLLECTION_ID,
            Image: { Bytes: image },
            MaxFaces: 5,
            FaceMatchThreshold: DUPLICATE_THRESHOLD,
          }),
        );
        const clash = (dup.FaceMatches || []).find(
          (m) => m.Face?.ExternalImageId && m.Face.ExternalImageId !== externalId,
        );
        if (clash) {
          throw new Error(
            `${label}: this face is already enrolled for another employee (${clash.Face?.ExternalImageId}).`,
          );
        }
      } catch (err: any) {
        if (err?.name !== 'InvalidParameterException') throw err; // "no face" is already handled above
      }

      const indexed = await client.send(
        new IndexFacesCommand({
          CollectionId: COLLECTION_ID,
          Image: { Bytes: image },
          ExternalImageId: externalId,
          MaxFaces: 1,
          QualityFilter: 'AUTO',
          DetectionAttributes: [],
        }),
      );

      const faceId = indexed.FaceRecords?.[0]?.Face?.FaceId;
      if (!faceId) throw new Error(`${label}: face could not be indexed. Retake the photo.`);
      faceIds.push(faceId);
    }

    return { success: true, faceIds, message: `${faceIds.length} face photo(s) enrolled.` };
  } catch (err: any) {
    // Roll back anything indexed in this attempt so we never leave partial data behind.
    if (faceIds.length > 0) await deleteFaces(faceIds).catch(() => undefined);
    return { success: false, faceIds: [], message: err?.message || 'Face enrollment failed.' };
  }
}

/* ------------------------------------------------------------------ *
 *  VERIFICATION (every punch)
 * ------------------------------------------------------------------ */
export async function verifyFace(employeeId: string, image: Buffer): Promise<FaceCheckResult> {
  await ensureCollection();
  const externalId = toExternalId(employeeId);

  const quality = await checkFaceQuality(image);
  if (quality.status !== 'MATCH') return quality;

  try {
    const res = await client.send(
      new SearchFacesByImageCommand({
        CollectionId: COLLECTION_ID,
        Image: { Bytes: image },
        MaxFaces: 5,
        FaceMatchThreshold: MATCH_THRESHOLD,
      }),
    );

    // The match MUST belong to the logged-in employee. Matching someone else = rejected.
    const mine = (res.FaceMatches || [])
      .filter((m) => m.Face?.ExternalImageId === externalId)
      .sort((a, b) => (b.Similarity ?? 0) - (a.Similarity ?? 0))[0];

    if (mine) {
      return {
        status: 'MATCH',
        similarity: Math.round((mine.Similarity ?? 0) * 100) / 100,
        message: 'Face verified.',
      };
    }
    return { status: 'MISMATCH', message: 'Face does not match the enrolled profile for this account.' };
  } catch (err: any) {
    if (err?.name === 'InvalidParameterException') {
      return { status: 'NO_FACE', message: 'No face detected. Look straight at the camera.' };
    }
    throw err;
  }
}

/* ------------------------------------------------------------------ *
 *  CLEANUP
 * ------------------------------------------------------------------ */
export async function deleteFaces(faceIds: string[]): Promise<void> {
  if (!faceIds || faceIds.length === 0) return;
  await ensureCollection();
  await client.send(new DeleteFacesCommand({ CollectionId: COLLECTION_ID, FaceIds: faceIds }));
}