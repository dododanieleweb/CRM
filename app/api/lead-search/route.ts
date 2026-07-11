import { NextResponse } from "next/server";

export const runtime = "nodejs";

type GoogleAddressComponent = {
  longText?: string;
  shortText?: string;
  types?: string[];
};

type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  googleMapsUri?: string;
  primaryTypeDisplayName?: { text?: string };
  addressComponents?: GoogleAddressComponent[];
};

function addressPart(place: GooglePlace, type: string) {
  return place.addressComponents?.find((component) => component.types?.includes(type))?.longText || "";
}

function normalizePlace(place: GooglePlace) {
  const streetNumber = addressPart(place, "street_number");
  const route = addressPart(place, "route");
  const city = addressPart(place, "locality") || addressPart(place, "administrative_area_level_3") || addressPart(place, "postal_town");

  return {
    id: place.id || crypto.randomUUID(),
    company: place.displayName?.text || "Azienda senza nome",
    sector: place.primaryTypeDisplayName?.text || "Da qualificare",
    owner: "Da assegnare",
    email: "",
    phone: place.nationalPhoneNumber || place.internationalPhoneNumber || "",
    address: route,
    houseNumber: streetNumber,
    city,
    formattedAddress: place.formattedAddress || "",
    website: place.websiteUri || "",
    sourceUrl: place.googleMapsUri || "",
    notes: [
      place.websiteUri ? `Sito: ${place.websiteUri}` : "",
      place.googleMapsUri ? `Google Maps: ${place.googleMapsUri}` : ""
    ].filter(Boolean).join("\n")
  };
}

export async function POST(request: Request) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Configura GOOGLE_PLACES_API_KEY su Netlify per usare la ricerca online." }, { status: 503 });
  }

  const body = await request.json().catch(() => null) as { activity?: string; city?: string; limit?: number } | null;
  const activity = String(body?.activity || "").trim();
  const city = String(body?.city || "").trim();
  const limit = Math.min(20, Math.max(1, Number(body?.limit || 10)));

  if (!activity || !city) {
    return NextResponse.json({ error: "Inserisci attivita e citta da cercare." }, { status: 400 });
  }

  const response = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.googleMapsUri,places.primaryTypeDisplayName,places.addressComponents"
    },
    body: JSON.stringify({
      textQuery: `${activity} a ${city}`,
      languageCode: "it",
      regionCode: "IT",
      maxResultCount: limit
    })
  });

  const result = await response.json().catch(() => null) as { places?: GooglePlace[]; error?: { message?: string } } | null;
  if (!response.ok) {
    return NextResponse.json({ error: result?.error?.message || "Ricerca online non riuscita." }, { status: response.status });
  }

  return NextResponse.json({ leads: (result?.places || []).map(normalizePlace) });
}
