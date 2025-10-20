import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { holdedEstimateId } = await req.json();
    
    if (!holdedEstimateId) {
      throw new Error('holdedEstimateId is required');
    }

    // Use API key directly
    const apiKey = '88610992d47b9783e7703c488a8c01cf';
    console.log('=== HOLDED PDF DOWNLOAD DEBUG ===');
    console.log('Holded Estimate ID:', holdedEstimateId);
    console.log('API Key (first 10):', apiKey.substring(0, 10) + '...');
    console.log('Full URL:', `https://api.holded.com/api/invoicing/v1/documents/estimate/${holdedEstimateId}/pdf`);
    console.log('================================');

    // Download PDF from Holded
    const holdedResponse = await fetch(
      `https://api.holded.com/api/invoicing/v1/documents/estimate/${holdedEstimateId}/pdf`,
      {
        method: 'GET',
        headers: {
          'accept': 'application/pdf',
          'key': apiKey
        }
      }
    );

    if (!holdedResponse.ok) {
      const errorText = await holdedResponse.text();
      console.error('Holded API error:', holdedResponse.status, errorText);
      throw new Error(`Holded API error: ${holdedResponse.status} - ${errorText}`);
    }

    // Parse JSON response
    const responseJson = await holdedResponse.json();
    console.log('Response status:', responseJson.status);
    
    if (responseJson.status !== 1 || !responseJson.data) {
      throw new Error('Invalid response from Holded API');
    }

    // Decode base64 PDF data
    const pdfBase64 = responseJson.data;
    const binaryString = atob(pdfBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    console.log('PDF decoded successfully, size:', bytes.length);

    // Return the PDF
    return new Response(bytes, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="presupuesto-${holdedEstimateId}.pdf"`
      },
      status: 200
    });

  } catch (error) {
    console.error('Error in holded-download-pdf:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Failed to download PDF from Holded'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
