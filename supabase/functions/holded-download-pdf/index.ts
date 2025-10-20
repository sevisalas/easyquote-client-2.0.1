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

    // Get the PDF as blob
    const pdfBlob = await holdedResponse.blob();
    
    console.log('PDF downloaded successfully, size:', pdfBlob.size);

    // Return the PDF
    return new Response(pdfBlob, {
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
