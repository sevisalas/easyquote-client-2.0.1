import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { corsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { holdedEstimateId, holdedDocumentId, documentType = 'estimate' } = await req.json();
    
    const documentId = holdedEstimateId || holdedDocumentId;
    
    if (!documentId) {
      throw new Error('holdedEstimateId or holdedDocumentId is required');
    }

    // Get user's organization (either as owner or member)
    let organizationId: string | null = null;
    
    const { data: ownedOrg } = await supabase
      .from('organizations')
      .select('id')
      .eq('api_user_id', user.id)
      .maybeSingle();
    
    if (ownedOrg) {
      organizationId = ownedOrg.id;
    } else {
      const { data: memberOrg } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (memberOrg) {
        organizationId = memberOrg.organization_id;
      }
    }
    
    if (!organizationId) {
      throw new Error('No se encontró organización para este usuario');
    }
    
    // Get Holded integration
    const { data: holdedIntegration } = await supabase
      .from('integrations')
      .select('id')
      .eq('name', 'Holded')
      .maybeSingle();
    
    if (!holdedIntegration) {
      throw new Error('Integración de Holded no encontrada');
    }
    
    // Get organization's Holded API key
    const { data: integrationAccess } = await supabase
      .from('organization_integration_access')
      .select('access_token_encrypted')
      .eq('organization_id', organizationId)
      .eq('integration_id', holdedIntegration.id)
      .eq('is_active', true)
      .maybeSingle();
    
    if (!integrationAccess?.access_token_encrypted) {
      throw new Error('API Key de Holded no configurada para esta organización');
    }
    
    // Decrypt the API key
    const { data: decryptedKey, error: decryptError } = await supabase
      .rpc('decrypt_credential', { encrypted_data: integrationAccess.access_token_encrypted });
    
    if (decryptError || !decryptedKey) {
      console.error('Error decrypting Holded API key:', decryptError);
      throw new Error('Error al descifrar la API Key de Holded');
    }
    
    const apiKey = decryptedKey;
    
    // Determine the correct endpoint based on document type
    const endpoint = documentType === 'salesorder' 
      ? `https://api.holded.com/api/invoicing/v1/documents/salesorder/${documentId}/pdf`
      : `https://api.holded.com/api/invoicing/v1/documents/estimate/${documentId}/pdf`;
    
    console.log('=== HOLDED PDF DOWNLOAD DEBUG ===');
    console.log('Document ID:', documentId);
    console.log('Document Type:', documentType);
    console.log('Organization ID:', organizationId);
    console.log('Full URL:', endpoint);
    console.log('================================');

    // Download PDF from Holded
    const holdedResponse = await fetch(
      endpoint,
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
    
    // Return PDF
    return new Response(bytes, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="document-${documentId}.pdf"`
      }
    });

  } catch (error) {
    console.error('Error downloading PDF from Holded:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
