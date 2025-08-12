export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export function corsJson(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...(init || {}),
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}), ...corsHeaders },
  });
}

export function corsEmpty(status = 204) {
  return new Response(null, { status, headers: { ...corsHeaders } });
}


