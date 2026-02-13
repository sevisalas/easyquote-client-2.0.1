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

    const { holdedDocumentId, docType, organizationId, quoteId, salesOrderId } = await req.json();

    if (!holdedDocumentId || !docType || !organizationId) {
      throw new Error('holdedDocumentId, docType and organizationId are required');
    }

    if (!['estimate', 'salesorder'].includes(docType)) {
      throw new Error('docType must be "estimate" or "salesorder"');
    }

    // Verify user is member of organization
    const { data: memberCheck } = await supabase
      .from('organization_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (!memberCheck) {
      // Check if owner
      const { data: ownerCheck } = await supabase
        .from('organizations')
        .select('id')
        .eq('id', organizationId)
        .eq('api_user_id', user.id)
        .maybeSingle();

      if (!ownerCheck) {
        throw new Error('No tienes permiso para esta organización');
      }
    }

    // Get Holded API key
    const { data: holdedIntegration } = await supabase
      .from('integrations')
      .select('id')
      .eq('name', 'Holded')
      .maybeSingle();

    if (!holdedIntegration) {
      throw new Error('Integración de Holded no encontrada');
    }

    const { data: integrationAccess } = await supabase
      .from('organization_integration_access')
      .select('access_token_encrypted')
      .eq('organization_id', organizationId)
      .eq('integration_id', holdedIntegration.id)
      .eq('is_active', true)
      .maybeSingle();

    if (!integrationAccess?.access_token_encrypted) {
      throw new Error('API Key de Holded no configurada');
    }

    const { data: apiKey, error: decryptError } = await supabase
      .rpc('decrypt_credential', { encrypted_data: integrationAccess.access_token_encrypted });

    if (decryptError || !apiKey) {
      throw new Error('Error al descifrar la API Key de Holded');
    }

    // Get attachments for this document
    let attachQuery = supabase
      .from('document_attachments')
      .select('*')
      .eq('organization_id', organizationId);

    if (quoteId) {
      attachQuery = attachQuery.eq('quote_id', quoteId);
    } else if (salesOrderId) {
      attachQuery = attachQuery.eq('sales_order_id', salesOrderId);
    } else {
      console.log('No quoteId or salesOrderId provided, no attachments to send');
      return new Response(
        JSON.stringify({ success: true, attached: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const { data: attachments, error: attachError } = await attachQuery;

    if (attachError) {
      console.error('Error fetching attachments:', attachError);
      throw new Error('Error fetching attachments');
    }

    if (!attachments || attachments.length === 0) {
      console.log('No attachments found for this document');
      return new Response(
        JSON.stringify({ success: true, attached: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log(`Found ${attachments.length} attachments to send to Holded`);

    const results: { fileName: string; success: boolean; error?: string }[] = [];

    for (const attachment of attachments) {
      try {
        // Download file from storage using service role
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('document-attachments')
          .download(attachment.file_path);

        if (downloadError || !fileData) {
          console.error(`Error downloading ${attachment.file_name}:`, downloadError);
          results.push({ fileName: attachment.file_name, success: false, error: 'Download failed' });
          continue;
        }

        // Build FormData for Holded attach API
        const formData = new FormData();
        formData.append('file', fileData, attachment.file_name);

        const holdedUrl = `https://api.holded.com/api/invoicing/v1/documents/${docType}/${holdedDocumentId}/attach`;
        console.log(`Attaching ${attachment.file_name} to Holded: ${holdedUrl}`);

        const holdedResponse = await fetch(holdedUrl, {
          method: 'POST',
          headers: {
            'key': apiKey,
            'accept': 'application/json',
          },
          body: formData,
        });

        const responseText = await holdedResponse.text();
        console.log(`Holded attach response for ${attachment.file_name}:`, holdedResponse.status, responseText);

        if (!holdedResponse.ok) {
          results.push({ fileName: attachment.file_name, success: false, error: responseText });
        } else {
          results.push({ fileName: attachment.file_name, success: true });
        }
      } catch (err: any) {
        console.error(`Error attaching ${attachment.file_name}:`, err);
        results.push({ fileName: attachment.file_name, success: false, error: err.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`Attached ${successCount}/${attachments.length} files to Holded document ${holdedDocumentId}`);

    return new Response(
      JSON.stringify({ success: true, attached: successCount, total: attachments.length, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error('Error in holded-attach-document:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to attach documents' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
