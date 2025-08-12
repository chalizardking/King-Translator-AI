const CONFIG = {
    API: {
      providers: {
        gemini: {
          baseUrl: "https://generativelanguage.googleapis.com/v1beta/models",
          uploadUrl: "https://generativelanguage.googleapis.com/upload/v1beta/files",
          models: {
            fast: [
              "gemini-2.5-flash-lite",
              "gemini-2.5-flash-lite-preview-06-17",
              "gemini-2.5-flash",
              "gemini-2.5-flash-preview-05-20",
              "gemini-2.0-flash-exp",
              "gemini-2.0-flash",
              "gemini-2.0-flash-001",
              "gemini-2.0-flash-lite",
              "gemini-2.0-flash-lite-001",
              "gemini-1.5-flash",
              "gemini-1.5-flash-8b"
            ],
            pro: [
              "gemini-2.5-pro",
              "gemini-2.5-pro-preview-06-05",
              "gemini-2.5-pro-preview-05-06",
              "gemini-2.5-pro-exp-03-25",
              "gemini-2.0-pro-exp-02-05",
              "gemini-2.0-pro-exp",
              "gemini-1.5-pro"
            ],
            think: [
              "gemini-2.0-flash-thinking-exp-1219",
              "gemini-2.0-flash-thinking-exp-01-21",
              "gemini-2.0-flash-thinking-exp"
            ]
          },
          limits: {
            maxDirectSize: 15 * 1024 * 1024, // 15MB for base64
            maxUploadSize: {
              document: 2 * 1024 * 1024 * 1024,  // 2GB for document
              image: 2 * 1024 * 1024 * 1024,   // 2GB for image
              video: 2 * 1024 * 1024 * 1024,  // 2GB for videos
              audio: 2 * 1024 * 1024 * 1024   // 2GB for audio
            }
          },
          headers: { "Content-Type": "application/json" },
          createRequestBody: (content, generation = {}) => ({
            contents: [{
              parts: Array.isArray(content) ? content : [{
                text: content
              }]
            }],
            generationConfig: generation
          }),
          createBinaryParts: (prompt, mimeType, base64Data) => [
            { text: prompt },
            {
              inline_data: {
                mime_type: mimeType,
                data: base64Data
              }
            }
          ],
          responseParser: (response) => {
            if (typeof response === "string") {
              return response;
            }
            if (response?.candidates?.[0]?.content?.parts?.[0]?.text) {
              return response.candidates[0].content.parts[0].text;
            }
            throw new Error((this._("notifications.failed_read_api")));
          }
        },
        perplexity: {
          baseUrl: "https://api.perplexity.ai/chat/completions",
          models: {
            fast: ["sonar", "sonar-reasoning"],
            balance: ["sonar-deep-research", "r1-1776"],
            pro: ["sonar-reasoning-pro", "sonar-pro"]
          },
          headers: (apiKey) => ({
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          }),
          createRequestBody: (content, model = "sonar", tem = 0.6, topp = 0.8, topk = 30) => ({
            model: model,
            max_tokens: 65536,
            messages: [{
              role: "user",
              content: content
            }],
            temperature: tem,
            top_p: topp,
            top_k: topk
          }),
          createBinaryParts: (prompt, mimeType, base64Data) => [
            {
              type: "text",
              text: prompt
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Data}`
              }
            }
          ],
          responseParser: (response) => {
            if (typeof response === "string") {
              return response;
            }
            if (response?.choices?.[0]?.message?.content) {
              return response.choices[0].message.content;
            }
            throw new Error((this._("notifications.failed_read_api")));
          }
        },
        claude: {
          baseUrl: "https://api.anthropic.com/v1/messages",
          models: {
            fast: [
              "claude-3-5-haiku-latest",
              "claude-3-5-haiku-20241022",
              "claude-3-haiku-20240307"
            ],
            balance: [
              "claude-3-7-sonnet-latest",
              "claude-3-7-sonnet-20250219",
              "claude-3-5-sonnet-latest",
              "claude-3-5-sonnet-20241022",
              "claude-3-5-sonnet-20240620",
              "claude-3-sonnet-20240229"
            ],
            pro: [
              "claude-3-opus-latest",
              "claude-3-opus-20240229"
            ]
          },
          headers: (apiKey) => ({
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json"
          }),
          createRequestBody: (content, model = "claude-3-7-sonnet-latest", tem = 0.6, topp = 0.8, topk = 30) => ({
            model: model,
            max_tokens: 65536,
            messages: [{
              role: "user",
              content: content
            }],
            temperature: tem,
            top_p: topp,
            top_k: topk
          }),
          createBinaryParts: (prompt, mimeType, base64Data) => [
            {
              type: "text",
              text: prompt
            },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mimeType,
                data: base64Data
              }
            }
          ],
          responseParser: (response) => {
            if (typeof response === "string") {
              return response;
            }
            if (response?.content?.[0]?.text) {
              return response.content[0].text;
            }
            throw new Error("Invalid response format from Claude API");
          }
        },
        openai: {
          baseUrl: "https://api.openai.com/v1/responses",
          models: {
            fast: ["gpt-4.1-nano", "gpt-4.1-mini", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
            balance: ["gpt-4.1", "gpt-4o"],
            pro: ["o1-pro"]
          },
          headers: (apiKey) => ({
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          }),
          createRequestBody: (content, model = "gpt-4.1-nano", tem = 0.6, topp = 0.8) => ({
            model: model,
            input: [{
              role: "user",
              content: content
            }],
            temperature: tem,
            top_p: topp
          }),
          createBinaryParts: (prompt, mimeType, base64Data) => [
            {
              type: "input_text",
              text: prompt
            },
            {
              type: "input_image",
              image_url: `data:${mimeType};base64,${base64Data}`
            }
          ],
          responseParser: (response) => {
            if (typeof response === "string") {
              return response;
            }
            if (response?.output?.[0]?.content?.[0]?.text) {
              return response.output[0].content[0].text;
            }
            throw new Error("Invalid response format from OpenAI API");
          }
        },
        mistral: {
          baseUrl: "https://api.mistral.ai/v1/chat/completions",
          models: {
            free: [
              "mistral-small-latest",
              "pixtral-12b-2409"
            ],
            research: [
              "open-mistral-nemo",
              "open-codestral-mamba"
            ],
            premier: [
              "codestral-latest",
              "mistral-large-latest",
              "pixtral-large-latest",
              "mistral-saba-latest",
              "ministral-3b-latest",
              "ministral-8b-latest",
              "mistral-moderation-latest",
              "mistral-ocr-latest"
            ]
          },
          headers: (apiKey) => ({
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          }),
          createRequestBody: (content, model = "mistral-small-latest", tem = 0.6, topp = 0.8) => ({
            model: model,
            max_tokens: 65536,
            messages: [{
              role: "user",
              content: Array.isArray(content) ? content : content
            }],
            temperature: tem,
            top_p: topp
          }),
          createBinaryParts: (prompt, mimeType, base64Data) => [
            {
              type: "text",
              text: prompt
            },
            {
              type: "image_url",
              image_url: `data:${mimeType};base64,${base64Data}`
            }
          ],
          responseParser: (response) => {
            if (typeof response === "string") {
              return response;
            }
            if (response?.choices?.[0]?.message?.content) {
              return response.choices[0].message.content;
            }
            throw new Error((this._("notifications.failed_read_api")));
          }
        },
        ollama: {
          models: {},
          headers: {
            "Content-Type": "application/json"
          },
          createRequestBody: (content, model, temperature, top_p, top_k) => {
            let prompt = '';
            let images = [];
            if (Array.isArray(content)) {
              content.forEach(part => {
                if (part.text) {
                  prompt = part.text;
                }
                if (part.images && Array.isArray(part.images)) {
                  images = part.images;
                }
              });
            } else {
              prompt = content;
            }
            const body = {
              model: model,
              prompt: prompt,
              stream: false,
              think: false,
              options: {
                temperature: temperature,
                top_p: top_p,
                top_k: top_k
              }
            };
            if (images.length > 0) {
              body.images = images;
            }
            console.log('body: ', body);
            return body;
          },
          createBinaryParts: (prompt, _mimeType, base64Data) => ([
            { text: prompt },
            { images: [base64Data] }
          ]),
          responseParser: (response) => {
            console.log('response: ', response);
            if (typeof response === "string") {
              return response;
            }
            if (response?.response) {
              return response.response;
            }
            throw new Error("Cannot read result from Ollama API.");
          }
        }
      },
      currentProvider: "gemini",
      apiKey: {
        gemini: [""],
        perplexity: [""],
        claude: [""],
        openai: [""],
        mistral: [""]
      },
      currentKeyIndex: {
        gemini: 0,
        perplexity: 0,
        claude: 0,
        openai: 0,
        mistral: 0
      },
      maxRetries: 5,
      retryDelay: 1000
    },
    LANG_DATA: {
      en: {
        script_name: "King Translator AI",
        auto_detect: "Auto-detect",
        settings: {
          title: "King Translator AI Settings",
          interface_section: "INTERFACE",
          theme_mode: "Theme Mode:",
          light: "Light",
          dark: "Dark",
          ui_language: "Interface Language:",
          api_provider_section: "API PROVIDER",
          api_model_section: "API MODEL",
          api_keys_section: "API KEYS",
          model_type: "Select Model Type:",
          fast: "Fast",
          balance: "Balance",
          pro: "Pro",
          think: "Think",
          custom: "Custom",
          model_label: "Model",
          custom_model_placeholder: "Enter custom model name",
          add_key: "+ Add {provider} Key",
          input_translation_section: "INPUT TRANSLATION",
          enable_feature: "Enable Feature:",
          save_position: "Save position when moved:",
          tools_section: "TRANSLATOR TOOLS ⚙️",
          enable_tools: "Enable Tools:",
          enable_tools_current_web: "Enable/Disable on this website only:",
          page_translation_section: "PAGE TRANSLATION",
          enable_page_translation: "Enable Page Translation:",
          show_initial_button: "Show translate button for 10s:",
          auto_translate_page: "Auto-translate page:",
          custom_selectors: "Custom Exclusion Selectors:",
          exclude_selectors: "Exclusion Selectors:",
          one_selector_per_line: "Enter each selector on a new line!",
          default_selectors: "Default Selectors:",
          default_selectors_info: "These are the default selectors used when custom selectors are disabled.",
          combine_with_default: "Combine with Default:",
          combine_with_default_info: "If enabled, custom selectors will be added to the default list instead of replacing them completely.",
          temperature: "Temperature:",
          top_p: "Top P:",
          top_k: "Top K:",
          prompt_settings_section: "CUSTOM PROMPTS",
          use_custom_prompt: "Use Custom Prompts:",
          prompt_normal: "Normal Translation Prompt (quick + popup):",
          prompt_normal_chinese: "Normal Translation Prompt (quick + popup)(IPA):",
          prompt_advanced: "Advanced Translation Prompt:",
          prompt_advanced_chinese: "Advanced Translation Prompt (IPA):",
          prompt_ocr: "OCR Prompt:",
          prompt_ocr_chinese: "OCR Prompt (IPA):",
          prompt_media: "Media Prompt:",
          prompt_media_chinese: "Media Prompt (IPA):",
          prompt_page: "Page Translation Prompt:",
          prompt_page_chinese: "Page Translation Prompt (IPA):",
          prompt_file_content: "File Translation Prompt (multimodal):",
          prompt_file_content_chinese: "File Translation Prompt (multimodal) (IPA):",
          enable_google_translate_page: "Enable Page Translate with Google Translate:",
          google_translate_layout: "Google Translate Display Layout:",
          google_translate_minimal: "Minimal (Context Bar Only)",
          google_translate_inline: "Inline (Automatic)",
          google_translate_selected: "Analyze and Translate",
          prompt_vars_info: "Available variables in prompts:",
          prompt_var_text: "{text} - Text to be translated",
          prompt_var_doc_title: "{docTitle} - Document Title",
          prompt_var_target_lang: "{targetLang} - Target Language",
          prompt_var_source_lang: "{sourceLang} - Source Language (if available)",
          prompt_notes: "Note:",
          prompt_notes_required: "The required parameter must use: {text} to allow the text to be translated to be substituted into the AI prompt.",
          prompt_note_en: "When providing custom phonetic input, request output in the following format: Original <|> IPA Transcription <|> Translation. For example: Hello <|> heˈloʊ <|> Xin chào.",
          prompt_note_zh: "For Chinese words, return its phonetic transcription as Pinyin + its tone number (1-4). For example: 你好 <|> Nǐ3 hǎo3 <|> Xin chào.",
          ocr_section: "IMAGE TEXT TRANSLATION (OCR)",
          enable_ocr: "Enable OCR Translation:",
          enable_manga_translate_all: "Enable 'Translate All' for manga (select 2 images):",
          enable_manga_translate_all_site_only: "Prioritize 'Translate All' for manga on this site:",
          media_section: "MEDIA TRANSLATION",
          enable_media: "Enable Media Translation:",
          video_streaming_section: "LIVE VIDEO SUBTITLE TRANSLATION",
          enable_video_streaming: "Enable Feature:",
          font_size: "Font Size:",
          background_color: "Background Color:",
          text_color: "Text Color:",
          display_section: "DISPLAY",
          display_mode: "Display Mode:",
          translation_only: "Translation Only",
          parallel: "Parallel Original and Translated Text",
          language_learning: "Language Learning Mode",
          show_source: "Show Original:",
          source_language: "Source Language:",
          target_language: "Target Language:",
          web_image_font_size: "Web Manga Translation Font Size:",
          popup_font_size: "Popup Font Size:",
          min_popup_width: "Minimum Popup Width:",
          max_popup_width: "Maximum Popup Width:",
          tts_section: "TEXT TO SPEECH",
          enable_tts: "Enable TTS:",
          tts_source: "TTS Source:",
          default_voice: "Default Voice:",
          voice: "Voice:",
          speed: "Default Speed:",
          pitch: "Default Pitch:",
          volume: "Default Volume:",
          context_menu_section: "CONTEXT MENU",
          enable_context_menu: "Enable Context Menu:",
          shortcuts_section: "SHORTCUTS",
          enable_settings_shortcut: "Enable Settings Shortcut:",
          enable_translation_shortcuts: "Enable Translation Shortcuts:",
          ocr_region_shortcut: "OCR Region Translate:",
          ocr_web_image_shortcut: "Web Image Translate:",
          manga_web_shortcut: "Manga Web Translate:",
          page_translate_shortcut: "Page Translate:",
          input_translate_shortcut: "Input Text Translate:",
          quick_translate_shortcut: "Quick Translate",
          popup_translate_shortcut: "Popup Translate",
          advanced_translate_shortcut: "Advanced Translate",
          button_options_section: "TRANSLATION BUTTON",
          enable_translation_button: "Enable Translation Button:",
          single_click: "Single Click:",
          double_click: "Double Click:",
          hold_button: "Hold Button:",
          touch_options_section: "MULTI-TOUCH",
          enable_touch: "Enable Touch:",
          two_fingers: "Two Fingers:",
          three_fingers: "Three Fingers:",
          sensitivity: "Sensitivity (ms):",
          rate_limit_section: "RATE LIMIT",
          max_requests: "Max Requests:",
          per_milliseconds: "Time Period (ms):",
          cache_section: "CACHE",
          text_cache: "Text Cache",
          enable_text_cache: "Enable Text Cache:",
          text_cache_max_size: "Text Cache Size:",
          text_cache_expiration: "Text Cache Expiration (ms):",
          image_cache: "Image Cache",
          enable_image_cache: "Enable Image Cache:",
          image_cache_max_size: "Image Cache Size:",
          image_cache_expiration: "Image Cache Expiration (ms):",
          media_cache: "Media Cache",
          enable_media_cache: "Enable Media Cache:",
          media_cache_max_size: "Media Cache Entries:",
          media_cache_expiration: "Expiration Time (seconds):",
          tts_cache: "TTS Cache",
          enable_tts_cache: "Enable TTS Cache:",
          tts_cache_max_size: "TTS Cache Entries:",
          tts_cache_expiration: "Expiration Time (seconds):",
          backup_settings_section: "SETTINGS BACKUP",
          export_settings: "Export Settings",
          import_settings: "Import Settings",
          cancel: "Cancel",
          save: "Save",
        },
        notifications: {
          export_success: "Settings exported successfully",
          export_error: "Error exporting settings",
          invalid_settings_file: "Invalid settings file",
          invalid_settings_format: "Invalid settings format",
          invalid_settings: "Invalid settings",
          decompression_error: "Could not decompress settings",
          import_success: "Settings imported successfully",
          import_error: "Import error:",
          no_api_key_configured: "No API key configured",
          no_api_key_available: "No available API keys. Please check API keys in settings.",
          all_keys_failed: "All API keys failed:\n",
          invalid_api_key: "API key {key_prefix}... is invalid",
          rate_limited_api_key: "API key {key_prefix}... exceeded rate limit",
          other_api_error: "Error with API key {key_prefix}...: {error_message}",
          rate_limited_info: "API key {key_prefix}... is rate-limited. Retrying in {time_left}s",
          too_many_requests: "is handling too many requests",
          network_error: "Network connection error",
          api_response_parse_error: "Could not process API response",
          unknown_api_error: "Unknown API error",
          unsupported_provider: "Invalid provider:",
          key_error: "Key {key_prefix}... error: {error_message}",
          translation_error: "Translation error:",
          screen_capture_error: "Screen capture error:",
          no_content_in_selection: "Selected area has no content",
          invalid_image_file: "Could not create valid image",
          cannot_identify_region: "Could not identify selection region",
          image_load_error: "Could not load image",
          canvas_security_error: "Canvas contains cross-origin content that cannot be accessed",
          cannot_capture_element: "Could not capture content from element",
          cannot_capture_screen: "Cannot capture screen: ",
          cannot_generate_valid: "Failed to generate valid image",
          invalid_screenshot: "Invalid screenshot",
          screenshot_cancel: "Selection cancelled",
          processing_image: "Processing image...",
          checking_cache: "Checking cache...",
          found_in_cache: "Found in cache",
          detecting_text: "Detecting text...",
          completed: "Completed",
          unsupported_file_format: "Unsupported file format",
          file_too_large: "File is too large.",
          processing_media: "Processing media...",
          processing_audio_video: "Processing audio/video...",
          translating: "Translating...",
          finalizing: "Finalizing...",
          cannot_process_media: "Could not process media",
          media_file_error: "Could not process file: {error_message}",
          caption_enable_error: "Error enabling captions:",
          cc_button_not_found: "CC button not found",
          cc_enabled: "CC enabled",
          cc_error: "Error enabling CC",
          caption_menu_opened: "Subtitle menu opened",
          failed_player_response: "Failed to get playerResponse",
          no_caption_tracks: "No caption tracks found",
          no_caption_track_url: "Could not find caption track URL",
          selected_track: "Selected track:",
          auto_generated: "(auto-generated)",
          no_valid_text_extracted: "Transcript events found, but no valid text content could be extracted.",
          no_video_found: "No video found",
          no_transcript_found: "No transcript found",
          process_frame_error: "Error processing video frame:",
          caption_translation_error: "Error translating caption",
          chunk_translation_error: "Error translating chunk:",
          translating_part: "Translating part ",
          upcoming_captions_error: "Error translating upcoming captions:",
          tried_n_times_original_text: "Tried {n} times, returning original text",
          live_caption_off: "Turn off translated subtitles",
          live_caption_on: "Turn on translated subtitles",
          live_caption_off2: "Video subtitle translation disabled",
          live_caption_on2: "Video subtitle translation enabled",
          video_container_not_found: "No suitable video container found",
          page_translation_disabled: "Page translation feature is disabled",
          auto_translate_disabled: "Auto-translate is off",
          page_already_target_lang: "Page is already in",
          language_detected: "Language detected: {language} (confidence: {confidence}%)",
          page_translated_partial: "Page translated ({failed_count} parts failed)",
          page_translated_success: "Page translated successfully",
          page_reverted_to_original: "Reverted to original text",
          no_content_to_translate: "No content found to translate",
          html_translation_error: "HTML file translation error:",
          pdf_translation_error: "PDF translation error:",
          node_update_error: "Node update error:",
          invalid_selector: "Invalid selector:",
          dom_update_error: "DOM update error:",
          response_parse_error: "Response parse error:",
          request_failed: "Request failed:",
          no_content_for_lang_detect: "No content found for language detection",
          backup_lang_detect_failed: "Backup language detection failed:",
          file_processing_error: "File processing error",
          json_processing_error: "JSON processing error",
          subtitle_processing_error: "Subtitle processing error",
          file_translation_error: "File translation error:",
          copied: "Copied!",
          no_text_selected: "No text selected",
          no_target_element: "No target element found",
          translator_instance_not_found: "Translator instance not found",
          browser_tts_not_supported: "Browser TTS not supported",
          tts_playback_error: "Playback error",
          audio_playback_error: "Audio playback error:",
          gtranslate_tts_error: "Google Translate TTS error:",
          google_tts_api_error: "Google TTS API error:",
          openai_tts_error: "OpenAI TTS error:",
          invalid_response_format: "Invalid response format",
          no_response_from_api: "No response from API",
          text_detection_error: "Text detection error:",
          no_blob_created: "Could not create blob",
          page_translate_loading: "Translating page...",
          processing_pdf: "Processing PDF...",
          html_file_translated_success: "HTML file translated successfully",
          pdf_translated_success: "PDF translated successfully",
          file_translated_success: "File translated successfully",
          file_input_title: "Select file or url to translate",
          processing: "Processing...",
          unknown_error: "Unknown error",
          rate_limit_wait: "Please wait between translations",
          auth_error: "API authentication error",
          generic_translation_error: "Translation error:",
          manga_guide_translate_all_prioritized: "Click any image to translate the whole chapter (Prioritized Mode)",
          manga_button_translate_single: "Translate This Image Only",
          ocr_click_guide: "Click image to OCR",
          manga_click_guide: "Click image to translate manga",
          manga_translate_all_button: "Translate All (Select 2 images)",
          manga_select_first_image: "Please select the first image...",
          manga_select_last_image: "One image selected. Please select the second image...",
          manga_common_parent_not_found: "Could not find a common story container. Please select two closer images.",
          manga_image_order_error: "Could not determine image order. Please try again.",
          manga_font_size_small: "small",
          manga_font_size_medium: "medium",
          manga_font_size_large: "large",
          tts_settings: "TTS Settings",
          tts_lang_no_voice: "No voice available for",
          ui_language: "UI Language:",
          ui_language_info: "Change the userscript's user interface language.",
          translation_tool_on: "Translation tool has been turned on",
          translation_tool_off: "Translation tool has been turned off",
          page_translate_menu_label: "Webpage Trans",
          ocr_region_menu_label: "OCR Region Trans",
          web_image_ocr_menu_label: "Web Image Trans",
          manga_web_menu_label: "Manga Web Trans",
          image_file_menu_label: "Image File Trans",
          media_file_menu_label: "Media File Trans",
          html_file_menu_label: "HTML File Trans",
          pdf_file_menu_label: "PDF File Trans",
          generic_file_menu_label: "File Translate",
          original_label: "Original",
          ipa_label: "IPA",
          translation_label: "Translate",
          original: "[ORIGIN]",
          ipa: "[IPA]",
          translation: "[TRANS]",
          translate: "Translate",
          settings: "King AI Settings",
          source_trans: "Trans to source language",
          target_trans: "Trans to target language",
          cap_gui: "Tap and drag to select translation area",
          failed_read_file: "Failed to read file",
          failed_read_api: "Failed to read API response",
          found_new_ele: "Find a new video element:",
          stop_cap: "Stopped translating subtitles",
          found_video: "Found video container:",
          lang_detect: "Language detection",
          reliability: "confidence",
          upl_url: "Could not create URL from the uploaded file",
          upl_uri: "Could not get file URI.",
          upl_fail: "Upload failed",
          uns_format: "Unsupported format",
          switch_layout: "Switch layout orientation",
          switch_layout_ver: "Switch to vertical layout",
          switch_layout_hor: "Switch to horizontal layout",
          device_tts: "Device TTS",
          un_pr_screen: "Could not process screenshot",
          un_cr_screen: "Could not create screenshot",
          play_tts: "Read text",
          stop_tts: "Stop reading",
          unsupport_file: "Unsupported file format. Only supports:",
          close_popup: "Close popup",
          generic_file_gemini_menu_label: "Translate VIP",
          only_gemini: "This feature only supports the Gemini API. Please select Gemini as the API Provider in the settings.",
          file_input_url_title: "Enter file URL to translate",
          file_input_url_placeholder: "Paste file URL here",
          invalid_url_format: "Invalid URL format. Please enter a valid URL (starting with http:// or https://).", // Add this line
          processing_url: "Processing URL...",
          unsupport_file_url_provider: "This API Provider does not support direct file URLs. Please select Gemini.",
          google_translate_page_menu_label: " Google Trans (Page)",
          google_translate_enabled: "Google Translate page translation enabled.",
          google_translate_already_active: "Google Translate is already active. Please refresh page to disable.",
          revert_google_translate_label: "Disable Google Translate",
          google_translate_unsupported: "Google Translate is not supported on this page.",
          reload_page_label: "Reload Page",
          not_find_video: "Could not find an active video after 3 minutes",
          get_transcript_error: "Error getting video transcript:",
          get_transcript_error_generic: "Could not get the transcript from YouTube after multiple attempts.",
          get_transcript_error_suggestion1: "Suggestion 1: Please try refreshing (F5) this page.",
          get_transcript_error_suggestion2: "Suggestion 2: If the error persists, try clearing cookies and site data for YouTube.",
        },
        logs: {
          manga_translate_all_started: "Starting to translate all images...",
          manga_no_images_found: "No valid images found in the selection.",
          manga_translating_progress: "Translating image {current} of {total}...",
          manga_translate_image_error: "Error translating image {index}:",
          manga_translate_all_completed: "Finished translating all images!",
        }
      }
    },
    TTS: {
      GEMINI: {
        MODEL: [
          'gemini-2.5-flash-preview-tts',
          'gemini-2.5-pro-preview-tts'
        ],
        VOICES: [
          'Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Leda', 'Orus',
          'Aoede', 'Callirrhoe', 'Autonoe', 'Enceladus', 'Iapetus',
          'Umbriel', 'Algieba', 'Despina', 'Erinome', 'Algenib',
          'Rasalgethi', 'Laomedeia', 'Achernar', 'Alnilam', 'Schedar',
          'Gacrux', 'Pulcherrima', 'Achird', 'Zubenelgenubi',
          'Vindemiatrix', 'Sadachbia', 'Sadaltager', 'Sulafat'
        ]
      },
      OPENAI: {
        MODEL: ['tts-1', 'tts-1-hd', 'gpt-4o-mini-tts'],
        VOICES: ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer', 'verse']
      },
      GOOGLE: {
        VOICES: {
          en: [
            { name: 'en-US-Standard-A', display: 'US Female 1 - Standard' },
            { name: 'en-US-Standard-B', display: 'US Male 1 - Standard' },
            { name: 'en-US-Standard-C', display: 'US Female 2 - Standard' },
            { name: 'en-US-Standard-D', display: 'US Male 2 - Standard' },
            { name: 'en-US-Standard-E', display: 'US Female 3 - Standard' },
            { name: 'en-US-Standard-F', display: 'US Female 4 - Standard' },
            { name: 'en-US-Standard-G', display: 'US Female 5 - Standard' },
            { name: 'en-US-Standard-H', display: 'US Female 6 - Standard' },
            { name: 'en-US-Standard-I', display: 'US Male 3 - Standard' },
            { name: 'en-US-Standard-J', display: 'US Male 4 - Standard' },
            { name: 'en-US-Wavenet-A', display: 'US Female 1 - Wavenet' },
            { name: 'en-US-Wavenet-B', display: 'US Male 1 - Wavenet' },
            { name: 'en-US-Wavenet-C', display: 'US Female 2 - Wavenet' },
            { name: 'en-US-Wavenet-D', display: 'US Male 2 - Wavenet' },
            { name: 'en-US-Wavenet-E', display: 'US Female 3 - Wavenet' },
            { name: 'en-US-Wavenet-F', display: 'US Female 4 - Wavenet' },
            { name: 'en-US-Wavenet-G', display: 'US Female 5 - Wavenet' },
            { name: 'en-US-Wavenet-H', display: 'US Female 6 - Wavenet' },
            { name: 'en-US-Wavenet-I', display: 'US Male 3 - Wavenet' },
            { name: 'en-US-Wavenet-J', display: 'US Male 4 - Wavenet' },
            { name: 'en-US-Neural2-A', display: 'US Female 1 - Neural2' },
            { name: 'en-US-Neural2-B', display: 'US Male 1 - Neural2' },
            { name: 'en-US-Neural2-C', display: 'US Female 2 - Neural2' },
            { name: 'en-US-Neural2-D', display: 'US Male 2 - Neural2' },
            { name: 'en-US-Neural2-E', display: 'US Female 3 - Neural2' },
            { name: 'en-US-Neural2-F', display: 'US Female 4 - Neural2' },
            { name: 'en-US-Neural2-G', display: 'US Female 5 - Neural2' },
            { name: 'en-US-Neural2-H', display: 'US Female 6 - Neural2' },
            { name: 'en-US-Neural2-I', display: 'US Male 3 - Neural2' },
            { name: 'en-US-Neural2-J', display: 'US Male 4 - Neural2' },
            { name: 'en-GB-Standard-A', display: 'UK Female 1 - Standard' },
            { name: 'en-GB-Standard-B', display: 'UK Male 1 - Standard' },
            { name: 'en-GB-Standard-C', display: 'UK Female 2 - Standard' },
            { name: 'en-GB-Standard-D', display: 'UK Male 2 - Standard' },
            { name: 'en-GB-Standard-F', display: 'UK Female 3 - Standard' },
            { name: 'en-GB-Wavenet-A', display: 'UK Female 1 - Wavenet' },
            { name: 'en-GB-Wavenet-B', display: 'UK Male 1 - Wavenet' },
            { name: 'en-GB-Wavenet-C', display: 'UK Female 2 - Wavenet' },
            { name: 'en-GB-Wavenet-D', display: 'UK Male 2 - Wavenet' },
            { name: 'en-GB-Wavenet-F', display: 'UK Female 3 - Wavenet' },
            { name: 'en-GB-Neural2-A', display: 'UK Female 1 - Neural2' },
            { name: 'en-GB-Neural2-B', display: 'UK Male 1 - Neural2' },
            { name: 'en-GB-Neural2-C', display: 'UK Female 2 - Neural2' },
            { name: 'en-GB-Neural2-D', display: 'UK Male 2 - Neural2' },
            { name: 'en-GB-Neural2-F', display: 'UK Female 3 - Neural2' }
          ],
          zh: [
            { name: 'cmn-CN-Standard-A', display: 'CN Female 1 - Standard' },
            { name: 'cmn-CN-Standard-B', display: 'CN Male 1 - Standard' },
            { name: 'cmn-CN-Standard-C', display: 'CN Male 2 - Standard' },
            { name: 'cmn-CN-Standard-D', display: 'CN Female 2 - Standard' },
            { name: 'cmn-CN-Wavenet-A', display: 'CN Female 1 - Wavenet' },
            { name: 'cmn-CN-Wavenet-B', display: 'CN Male 1 - Wavenet' },
            { name: 'cmn-CN-Wavenet-C', display: 'CN Male 2 - Wavenet' },
            { name: 'cmn-CN-Wavenet-D', display: 'CN Female 2 - Wavenet' },
            { name: 'cmn-CN-Neural2-A', display: 'CN Female 1 - Neural2' },
            { name: 'cmn-CN-Neural2-B', display: 'CN Male 1 - Neural2' },
            { name: 'cmn-CN-Neural2-C', display: 'CN Male 2 - Neural2' },
            { name: 'cmn-CN-Neural2-D', display: 'CN Female 2 - Neural2' },
            { name: 'cmn-TW-Standard-A', display: 'TW Female 1 - Standard' },
            { name: 'cmn-TW-Standard-B', display: 'TW Male 1 - Standard' },
            { name: 'cmn-TW-Standard-C', display: 'TW Male 2 - Standard' },
            { name: 'cmn-TW-Wavenet-A', display: 'TW Female 1 - Wavenet' },
            { name: 'cmn-TW-Wavenet-B', display: 'TW Male 1 - Wavenet' },
            { name: 'cmn-TW-Wavenet-C', display: 'TW Male 2 - Wavenet' },
            { name: 'cmn-TW-Neural2-A', display: 'TW Female 1 - Neural2' },
            { name: 'cmn-TW-Neural2-B', display: 'TW Male 1 - Neural2' },
            { name: 'cmn-TW-Neural2-C', display: 'TW Male 2 - Neural2' }
          ],
          ja: [
            { name: 'ja-JP-Standard-A', display: 'JP Female 1 - Standard' },
            { name: 'ja-JP-Standard-B', display: 'JP Female 2 - Standard' },
            { name: 'ja-JP-Standard-C', display: 'JP Male 1 - Standard' },
            { name: 'ja-JP-Standard-D', display: 'JP Male 2 - Standard' },
            { name: 'ja-JP-Wavenet-A', display: 'JP Female 1 - Wavenet' },
            { name: 'ja-JP-Wavenet-B', display: 'JP Female 2 - Wavenet' },
            { name: 'ja-JP-Wavenet-C', display: 'JP Male 1 - Wavenet' },
            { name: 'ja-JP-Wavenet-D', display: 'JP Male 2 - Wavenet' },
            { name: 'ja-JP-Neural2-A', display: 'JP Female 1 - Neural2' },
            { name: 'ja-JP-Neural2-B', display: 'JP Female 2 - Neural2' },
            { name: 'ja-JP-Neural2-C', display: 'JP Male 1 - Neural2' },
            { name: 'ja-JP-Neural2-D', display: 'JP Male 2 - Neural2' }
          ],
          ko: [
            { name: 'ko-KR-Standard-A', display: 'KR Female 1 - Standard' },
            { name: 'ko-KR-Standard-B', display: 'KR Female 2 - Standard' },
            { name: 'ko-KR-Standard-C', display: 'KR Male 1 - Standard' },
            { name: 'ko-KR-Standard-D', display: 'KR Male 2 - Standard' },
            { name: 'ko-KR-Wavenet-A', display: 'KR Female 1 - Wavenet' },
            { name: 'ko-KR-Wavenet-B', display: 'KR Female 2 - Wavenet' },
            { name: 'ko-KR-Wavenet-C', display: 'KR Male 1 - Wavenet' },
            { name: 'ko-KR-Wavenet-D', display: 'KR Male 2 - Wavenet' },
            { name: 'ko-KR-Neural2-A', display: 'KR Female 1 - Neural2' },
            { name: 'ko-KR-Neural2-B', display: 'KR Female 2 - Neural2' },
            { name: 'ko-KR-Neural2-C', display: 'KR Male 1 - Neural2' },
            { name: 'ko-KR-Neural2-D', display: 'KR Male 2 - Neural2' }
          ],
          fr: [
            { name: 'fr-FR-Standard-A', display: 'FR Female 1 - Standard' },
            { name: 'fr-FR-Standard-B', display: 'FR Male 1 - Standard' },
            { name: 'fr-FR-Standard-C', display: 'FR Female 2 - Standard' },
            { name: 'fr-FR-Standard-D', display: 'FR Male 2 - Standard' },
            { name: 'fr-FR-Standard-E', display: 'FR Female 3 - Standard' },
            { name: 'fr-FR-Wavenet-A', display: 'FR Female 1 - Wavenet' },
            { name: 'fr-FR-Wavenet-B', display: 'FR Male 1 - Wavenet' },
            { name: 'fr-FR-Wavenet-C', display: 'FR Female 2 - Wavenet' },
            { name: 'fr-FR-Wavenet-D', display: 'FR Male 2 - Wavenet' },
            { name: 'fr-FR-Wavenet-E', display: 'FR Female 3 - Wavenet' },
            { name: 'fr-FR-Neural2-A', display: 'FR Female 1 - Neural2' },
            { name: 'fr-FR-Neural2-B', display: 'FR Male 1 - Neural2' },
            { name: 'fr-FR-Neural2-C', display: 'FR Female 2 - Neural2' },
            { name: 'fr-FR-Neural2-D', display: 'FR Male 2 - Neural2' },
            { name: 'fr-FR-Neural2-E', display: 'FR Female 3 - Neural2' }
          ],
          de: [
            { name: 'de-DE-Standard-A', display: 'DE Female 1 - Standard' },
            { name: 'de-DE-Standard-B', display: 'DE Male 1 - Standard' },
            { name: 'de-DE-Standard-C', display: 'DE Female 2 - Standard' },
            { name: 'de-DE-Standard-D', display: 'DE Male 2 - Standard' },
            { name: 'de-DE-Standard-E', display: 'DE Male 3 - Standard' },
            { name: 'de-DE-Standard-F', display: 'DE Female 3 - Standard' },
            { name: 'de-DE-Wavenet-A', display: 'DE Female 1 - Wavenet' },
            { name: 'de-DE-Wavenet-B', display: 'DE Male 1 - Wavenet' },
            { name: 'de-DE-Wavenet-C', display: 'DE Female 2 - Wavenet' },
            { name: 'de-DE-Wavenet-D', display: 'DE Male 2 - Wavenet' },
            { name: 'de-DE-Wavenet-E', display: 'DE Male 3 - Wavenet' },
            { name: 'de-DE-Wavenet-F', display: 'DE Female 3 - Wavenet' },
            { name: 'de-DE-Neural2-A', display: 'DE Female 1 - Neural2' },
            { name: 'de-DE-Neural2-B', display: 'DE Male 1 - Neural2' },
            { name: 'de-DE-Neural2-C', display: 'DE Female 2 - Neural2' },
            { name: 'de-DE-Neural2-D', display: 'DE Male 2 - Neural2' },
            { name: 'de-DE-Neural2-E', display: 'DE Male 3 - Neural2' },
            { name: 'de-DE-Neural2-F', display: 'DE Female 3 - Neural2' }
          ],
          es: [
            { name: 'es-ES-Standard-A', display: 'ES Female 1 - Standard' },
            { name: 'es-ES-Standard-B', display: 'ES Male 1 - Standard' },
            { name: 'es-ES-Standard-C', display: 'ES Female 2 - Standard' },
            { name: 'es-ES-Standard-D', display: 'ES Male 2 - Standard' },
            { name: 'es-ES-Wavenet-A', display: 'ES Female 1 - Wavenet' },
            { name: 'es-ES-Wavenet-B', display: 'ES Male 1 - Wavenet' },
            { name: 'es-ES-Wavenet-C', display: 'ES Female 2 - Wavenet' },
            { name: 'es-ES-Wavenet-D', display: 'ES Male 2 - Wavenet' },
            { name: 'es-ES-Neural2-A', display: 'ES Female 1 - Neural2' },
            { name: 'es-ES-Neural2-B', display: 'ES Male 1 - Neural2' },
            { name: 'es-ES-Neural2-C', display: 'ES Female 2 - Neural2' },
            { name: 'es-ES-Neural2-D', display: 'ES Male 2 - Neural2' },
            { name: 'es-US-Standard-A', display: 'ES-US Female 1 - Standard' },
            { name: 'es-US-Standard-B', display: 'ES-US Male 1 - Standard' },
            { name: 'es-US-Standard-C', display: 'ES-US Male 2 - Standard' },
            { name: 'es-US-Wavenet-A', display: 'ES-US Female 1 - Wavenet' },
            { name: 'es-US-Wavenet-B', display: 'ES-US Male 1 - Wavenet' },
            { name: 'es-US-Wavenet-C', display: 'ES-US Male 2 - Wavenet' },
            { name: 'es-US-Neural2-A', display: 'ES-US Female 1 - Neural2' },
            { name: 'es-US-Neural2-B', display: 'ES-US Male 1 - Neural2' },
            { name: 'es-US-Neural2-C', display: 'ES-US Male 2 - Neural2' }
          ],
          it: [
            { name: 'it-IT-Standard-A', display: 'IT Female 1 - Standard' },
            { name: 'it-IT-Standard-B', display: 'IT Female 2 - Standard' },
            { name: 'it-IT-Standard-C', display: 'IT Male 1 - Standard' },
            { name: 'it-IT-Standard-D', display: 'IT Male 2 - Standard' },
            { name: 'it-IT-Wavenet-A', display: 'IT Female 1 - Wavenet' },
            { name: 'it-IT-Wavenet-B', display: 'IT Female 2 - Wavenet' },
            { name: 'it-IT-Wavenet-C', display: 'IT Male 1 - Wavenet' },
            { name: 'it-IT-Wavenet-D', display: 'IT Male 2 - Wavenet' },
            { name: 'it-IT-Neural2-A', display: 'IT Female 1 - Neural2' },
            { name: 'it-IT-Neural2-B', display: 'IT Female 2 - Neural2' },
            { name: 'it-IT-Neural2-C', display: 'IT Male 1 - Neural2' },
            { name: 'it-IT-Neural2-D', display: 'IT Male 2 - Neural2' }
          ],
          ru: [
            { name: 'ru-RU-Standard-A', display: 'RU Female 1 - Standard' },
            { name: 'ru-RU-Standard-B', display: 'RU Male 1 - Standard' },
            { name: 'ru-RU-Standard-C', display: 'RU Female 2 - Standard' },
            { name: 'ru-RU-Standard-D', display: 'RU Male 2 - Standard' },
            { name: 'ru-RU-Standard-E', display: 'RU Female 3 - Standard' },
            { name: 'ru-RU-Wavenet-A', display: 'RU Female 1 - Wavenet' },
            { name: 'ru-RU-Wavenet-B', display: 'RU Male 1 - Wavenet' },
            { name: 'ru-RU-Wavenet-C', display: 'RU Female 2 - Wavenet' },
            { name: 'ru-RU-Wavenet-D', display: 'RU Male 2 - Wavenet' },
            { name: 'ru-RU-Wavenet-E', display: 'RU Female 3 - Wavenet' }
          ],
          pt: [
            { name: 'pt-BR-Standard-A', display: 'PT-BR Female 1 - Standard' },
            { name: 'pt-BR-Standard-B', display: 'PT-BR Male 1 - Standard' },
            { name: 'pt-BR-Standard-C', display: 'PT-BR Female 2 - Standard' },
            { name: 'pt-BR-Wavenet-A', display: 'PT-BR Female 1 - Wavenet' },
            { name: 'pt-BR-Wavenet-B', display: 'PT-BR Male 1 - Wavenet' },
            { name: 'pt-BR-Wavenet-C', display: 'PT-BR Female 2 - Wavenet' },
            { name: 'pt-BR-Neural2-A', display: 'PT-BR Female 1 - Neural2' },
            { name: 'pt-BR-Neural2-B', display: 'PT-BR Male 1 - Neural2' },
            { name: 'pt-BR-Neural2-C', display: 'PT-BR Female 2 - Neural2' },
            { name: 'pt-PT-Standard-A', display: 'PT-PT Female 1 - Standard' },
            { name: 'pt-PT-Standard-B', display: 'PT-PT Male 1 - Standard' },
            { name: 'pt-PT-Standard-C', display: 'PT-PT Male 2 - Standard' },
            { name: 'pt-PT-Standard-D', display: 'PT-PT Female 2 - Standard' },
            { name: 'pt-PT-Wavenet-A', display: 'PT-PT Female 1 - Wavenet' },
            { name: 'pt-PT-Wavenet-B', display: 'PT-PT Male 1 - Wavenet' },
            { name: 'pt-PT-Wavenet-C', display: 'PT-PT Male 2 - Wavenet' },
            { name: 'pt-PT-Wavenet-D', display: 'PT-PT Female 2 - Wavenet' }
          ],
          nl: [
            { name: 'nl-NL-Standard-A', display: 'NL Female 1 - Standard' },
            { name: 'nl-NL-Standard-B', display: 'NL Male 1 - Standard' },
            { name: 'nl-NL-Standard-C', display: 'NL Male 2 - Standard' },
            { name: 'nl-NL-Standard-D', display: 'NL Female 2 - Standard' },
            { name: 'nl-NL-Standard-E', display: 'NL Female 3 - Standard' },
            { name: 'nl-NL-Wavenet-A', display: 'NL Female 1 - Wavenet' },
            { name: 'nl-NL-Wavenet-B', display: 'NL Male 1 - Wavenet' },
            { name: 'nl-NL-Wavenet-C', display: 'NL Male 2 - Wavenet' },
            { name: 'nl-NL-Wavenet-D', display: 'NL Female 2 - Wavenet' },
            { name: 'nl-NL-Wavenet-E', display: 'NL Female 3 - Wavenet' }
          ],
          pl: [
            { name: 'pl-PL-Standard-A', display: 'PL Female 1 - Standard' },
            { name: 'pl-PL-Standard-B', display: 'PL Male 1 - Standard' },
            { name: 'pl-PL-Standard-C', display: 'PL Male 2 - Standard' },
            { name: 'pl-PL-Standard-D', display: 'PL Female 2 - Standard' },
            { name: 'pl-PL-Standard-E', display: 'PL Female 3 - Standard' },
            { name: 'pl-PL-Wavenet-A', display: 'PL Female 1 - Wavenet' },
            { name: 'pl-PL-Wavenet-B', display: 'PL Male 1 - Wavenet' },
            { name: 'pl-PL-Wavenet-C', display: 'PL Male 2 - Wavenet' },
            { name: 'pl-PL-Wavenet-D', display: 'PL Female 2 - Wavenet' },
            { name: 'pl-PL-Wavenet-E', display: 'PL Female 3 - Wavenet' }
          ],
          tr: [
            { name: 'tr-TR-Standard-A', display: 'TR Female 1 - Standard' },
            { name: 'tr-TR-Standard-B', display: 'TR Male 1 - Standard' },
            { name: 'tr-TR-Standard-C', display: 'TR Female 2 - Standard' },
            { name: 'tr-TR-Standard-D', display: 'TR Female 3 - Standard' },
            { name: 'tr-TR-Standard-E', display: 'TR Male 2 - Standard' },
            { name: 'tr-TR-Wavenet-A', display: 'TR Female 1 - Wavenet' },
            { name: 'tr-TR-Wavenet-B', display: 'TR Male 1 - Wavenet' },
            { name: 'tr-TR-Wavenet-C', display: 'TR Female 2 - Wavenet' },
            { name: 'tr-TR-Wavenet-D', display: 'TR Female 3 - Wavenet' },
            { name: 'tr-TR-Wavenet-E', display: 'TR Male 2 - Wavenet' }
          ],
          ar: [
            { name: 'ar-XA-Standard-A', display: 'AR Female 1 - Standard' },
            { name: 'ar-XA-Standard-B', display: 'AR Male 1 - Standard' },
            { name: 'ar-XA-Standard-C', display: 'AR Male 2 - Standard' },
            { name: 'ar-XA-Standard-D', display: 'AR Female 2 - Standard' },
            { name: 'ar-XA-Wavenet-A', display: 'AR Female 1 - Wavenet' },
            { name: 'ar-XA-Wavenet-B', display: 'AR Male 1 - Wavenet' },
            { name: 'ar-XA-Wavenet-C', display: 'AR Male 2 - Wavenet' },
            { name: 'ar-XA-Wavenet-D', display: 'AR Female 2 - Wavenet' }
          ],
          th: [
            { name: 'th-TH-Standard-A', display: 'TH Female 1 - Standard' },
            { name: 'th-TH-Neural2-C', display: 'TH Female 2 - Neural2' }
          ],
          hi: [
            { name: 'hi-IN-Standard-A', display: 'HI Female 1 - Standard' },
            { name: 'hi-IN-Standard-B', display: 'HI Female 2 - Standard' },
            { name: 'hi-IN-Standard-C', display: 'HI Male 1 - Standard' },
            { name: 'hi-IN-Standard-D', display: 'HI Male 2 - Standard' },
            { name: 'hi-IN-Wavenet-A', display: 'HI Female 1 - Wavenet' },
            { name: 'hi-IN-Wavenet-B', display: 'HI Female 2 - Wavenet' },
            { name: 'hi-IN-Wavenet-C', display: 'HI Male 1 - Wavenet' },
            { name: 'hi-IN-Wavenet-D', display: 'HI Male 2 - Wavenet' }
          ],
          id: [
            { name: 'id-ID-Standard-A', display: 'ID Female 1 - Standard' },
            { name: 'id-ID-Standard-B', display: 'ID Male 1 - Standard' },
            { name: 'id-ID-Standard-C', display: 'ID Male 2 - Standard' },
            { name: 'id-ID-Standard-D', display: 'ID Female 2 - Standard' },
            { name: 'id-ID-Wavenet-A', display: 'ID Female 1 - Wavenet' },
            { name: 'id-ID-Wavenet-B', display: 'ID Male 1 - Wavenet' },
            { name: 'id-ID-Wavenet-C', display: 'ID Male 2 - Wavenet' },
            { name: 'id-ID-Wavenet-D', display: 'ID Female 2 - Wavenet' }
          ],
          ms: [
            { name: 'ms-MY-Standard-A', display: 'MS Female 1 - Standard' },
            { name: 'ms-MY-Standard-B', display: 'MS Male 1 - Standard' },
            { name: 'ms-MY-Standard-C', display: 'MS Female 2 - Standard' },
            { name: 'ms-MY-Standard-D', display: 'MS Male 2 - Standard' }
          ],
          fil: [
            { name: 'fil-PH-Standard-A', display: 'FIL Female 1 - Standard' },
            { name: 'fil-PH-Standard-B', display: 'FIL Female 2 - Standard' },
            { name: 'fil-PH-Standard-C', display: 'FIL Male 1 - Standard' },
            { name: 'fil-PH-Standard-D', display: 'FIL Male 2 - Standard' },
            { name: 'fil-PH-Wavenet-A', display: 'FIL Female 1 - Wavenet' },
            { name: 'fil-PH-Wavenet-B', display: 'FIL Female 2 - Wavenet' },
            { name: 'fil-PH-Wavenet-C', display: 'FIL Male 1 - Wavenet' },
            { name: 'fil-PH-Wavenet-D', display: 'FIL Male 2 - Wavenet' }
          ],
          cs: [
            { name: 'cs-CZ-Standard-A', display: 'CS Female 1 - Standard' },
            { name: 'cs-CZ-Wavenet-A', display: 'CS Female 1 - Wavenet' }
          ],
          el: [
            { name: 'el-GR-Standard-A', display: 'EL Female 1 - Standard' },
            { name: 'el-GR-Wavenet-A', display: 'EL Female 1 - Wavenet' }
          ],
          hu: [
            { name: 'hu-HU-Standard-A', display: 'HU Female 1 - Standard' },
            { name: 'hu-HU-Wavenet-A', display: 'HU Female 1 - Wavenet' }
          ],
          da: [
            { name: 'da-DK-Standard-A', display: 'DA Female 1 - Standard' },
            { name: 'da-DK-Standard-C', display: 'DA Male 1 - Standard' },
            { name: 'da-DK-Standard-D', display: 'DA Female 2 - Standard' },
            { name: 'da-DK-Standard-E', display: 'DA Female 3 - Standard' },
            { name: 'da-DK-Wavenet-A', display: 'DA Female 1 - Wavenet' },
            { name: 'da-DK-Wavenet-C', display: 'DA Male 1 - Wavenet' },
            { name: 'da-DK-Wavenet-D', display: 'DA Female 2 - Wavenet' },
            { name: 'da-DK-Wavenet-E', display: 'DA Female 3 - Wavenet' }
          ],
          fi: [
            { name: 'fi-FI-Standard-A', display: 'FI Female 1 - Standard' },
            { name: 'fi-FI-Wavenet-A', display: 'FI Female 1 - Wavenet' }
          ],
          nb: [
            { name: 'nb-NO-Standard-A', display: 'NB Female 1 - Standard' },
            { name: 'nb-NO-Standard-B', display: 'NB Male 1 - Standard' },
            { name: 'nb-NO-Standard-C', display: 'NB Female 2 - Standard' },
            { name: 'nb-NO-Standard-D', display: 'NB Male 2 - Standard' },
            { name: 'nb-NO-Standard-E', display: 'NB Female 3 - Standard' },
            { name: 'nb-NO-Wavenet-A', display: 'NB Female 1 - Wavenet' },
            { name: 'nb-NO-Wavenet-B', display: 'NB Male 1 - Wavenet' },
            { name: 'nb-NO-Wavenet-C', display: 'NB Female 2 - Wavenet' },
            { name: 'nb-NO-Wavenet-D', display: 'NB Male 2 - Wavenet' },
            { name: 'nb-NO-Wavenet-E', display: 'NB Female 3 - Wavenet' }
          ],
          sv: [
            { name: 'sv-SE-Standard-A', display: 'SV Female 1 - Standard' },
            { name: 'sv-SE-Standard-B', display: 'SV Female 2 - Standard' },
            { name: 'sv-SE-Standard-C', display: 'SV Male 1 - Standard' },
            { name: 'sv-SE-Standard-D', display: 'SV Male 2 - Standard' },
            { name: 'sv-SE-Standard-E', display: 'SV Female 3 - Standard' },
            { name: 'sv-SE-Wavenet-A', display: 'SV Female 1 - Wavenet' },
            { name: 'sv-SE-Wavenet-B', display: 'SV Female 2 - Wavenet' },
            { name: 'sv-SE-Wavenet-C', display: 'SV Male 1 - Wavenet' },
            { name: 'sv-SE-Wavenet-D', display: 'SV Male 2 - Wavenet' },
            { name: 'sv-SE-Wavenet-E', display: 'SV Female 3 - Wavenet' }
          ]
        }
      }
    },
    LANGUAGEDISPLAY: {
      en: { name: 'en', display: 'English' },
      'en-US': { name: 'en-US', display: 'English (US)' },
      'en-GB': { name: 'en-GB', display: 'English (UK)' },
      'en-AU': { name: 'en-AU', display: 'English (Australia)' },
      zh: { name: 'zh', display: '中文' },
      'zh-CN': { name: 'zh-CN', display: '中文 (简体)' },
      'zh-TW': { name: 'zh-TW', display: '中文 (繁體)' },
      'zh-HK': { name: 'zh-HK', display: '中文 (香港)' },
      ja: { name: 'ja', display: '日本語' },
      ko: { name: 'ko', display: '한국어' },
      fr: { name: 'fr', display: 'Français' },
      'fr-FR': { name: 'fr-FR', display: 'Français (France)' },
      'fr-CA': { name: 'fr-CA', display: 'Français (Canada)' },
      de: { name: 'de', display: 'Deutsch' },
      'de-DE': { name: 'de-DE', display: 'Deutsch (Deutschland)' },
      'de-AT': { name: 'de-AT', display: 'Deutsch (Österreich)' },
      'de-CH': { name: 'de-CH', display: 'Deutsch (Schweiz)' },
      es: { name: 'es', display: 'Español' },
      'es-ES': { name: 'es-ES', display: 'Español (España)' },
      'es-MX': { name: 'es-MX', display: 'Español (México)' },
      'es-US': { name: 'es-US', display: 'Español (Estados Unidos)' },
      it: { name: 'it', display: 'Italiano' },
      ru: { name: 'ru', display: 'Русский' },
      pt: { name: 'pt', display: 'Português' },
      'pt-BR': { name: 'pt-BR', display: 'Português (Brasil)' },
      'pt-PT': { name: 'pt-PT', display: 'Português (Portugal)' },
      nl: { name: 'nl', display: 'Nederlands' },
      pl: { name: 'pl', display: 'Polski' },
      tr: { name: 'tr', display: 'Türkçe' },
      ar: { name: 'ar', display: 'العربية' },
      th: { name: 'th', display: 'ไทย' },
      hi: { name: 'hi', display: 'हिन्दी' },
      id: { name: 'id', display: 'Indonesia' },
      ms: { name: 'ms', display: 'Melayu' },
      fil: { name: 'fil', display: 'Filipino' },
      'es-AR': { name: 'es-AR', display: 'Español (Argentina)' },
      'es-BO': { name: 'es-BO', display: 'Español (Bolivia)' },
      'es-CL': { name: 'es-CL', display: 'Español (Chile)' },
      'es-CO': { name: 'es-CO', display: 'Español (Colombia)' },
      'es-CR': { name: 'es-CR', display: 'Español (Costa Rica)' },
      'es-CU': { name: 'es-CU', display: 'Español (Cuba)' },
      'es-DO': { name: 'es-DO', display: 'Español (República Dominicana)' },
      'es-EC': { name: 'es-EC', display: 'Español (Ecuador)' },
      'es-SV': { name: 'es-SV', display: 'Español (El Salvador)' },
      'es-GT': { name: 'es-GT', display: 'Español (Guatemala)' },
      'es-HN': { name: 'es-HN', display: 'Español (Honduras)' },
      'es-NI': { name: 'es-NI', display: 'Español (Nicaragua)' },
      'es-PA': { name: 'es-PA', display: 'Español (Panamá)' },
      'es-PY': { name: 'es-PY', display: 'Español (Paraguay)' },
      'es-PE': { name: 'es-PE', display: 'Español (Perú)' },
      'es-PR': { name: 'es-PR', display: 'Español (Puerto Rico)' },
      'es-UY': { name: 'es-UY', display: 'Español (Uruguay)' },
      'es-VE': { name: 'es-VE', display: 'Español (Venezuela)' },
      'ar-AE': { name: 'ar-AE', display: 'العربية (الإمارات)' },
      'ar-BH': { name: 'ar-BH', display: 'العربية (البحرين)' },
      'ar-DZ': { name: 'ar-DZ', display: 'العربية (الجزائر)' },
      'ar-EG': { name: 'ar-EG', display: 'العربية (مصر)' },
      'ar-IQ': { name: 'ar-IQ', display: 'العربية (العراق)' },
      'ar-JO': { name: 'ar-JO', display: 'العربية (الأردن)' },
      'ar-KW': { name: 'ar-KW', display: 'العربية (الكويت)' },
      'ar-LB': { name: 'ar-LB', display: 'العربية (لبنان)' },
      'ar-LY': { name: 'ar-LY', display: 'العربية (ليبيا)' },
      'ar-MA': { name: 'ar-MA', display: 'العربية (المغرب)' },
      'ar-OM': { name: 'ar-OM', display: 'العربية (عُمان)' },
      'ar-QA': { name: 'ar-QA', display: 'العربية (قطر)' },
      'ar-SA': { name: 'ar-SA', display: 'العربية (السعودية)' },
      'ar-SY': { name: 'ar-SY', display: 'العربية (سوريا)' },
      'ar-TN': { name: 'ar-TN', display: 'العربية (تونس)' },
      'ar-YE': { name: 'ar-YE', display: 'العربية (اليمن)' },
      'bn-BD': { name: 'bn-BD', display: 'বাংলা (বাংলাদেশ)' },
      'bn-IN': { name: 'bn-IN', display: 'বাংলা (ভারত)' },
      'gu': { name: 'gu', display: 'ગુજરાતી' },
      'kn': { name: 'kn', display: 'ಕನ್ನಡ' },
      'ml': { name: 'ml', display: 'മലയാളം' },
      'mr': { name: 'mr', display: 'मराठी' },
      'ne': { name: 'ne', display: 'नेपाली' },
      'pa': { name: 'pa', display: 'ਪੰਜਾਬੀ' },
      'si': { name: 'si', display: 'සිංහල' },
      'ta': { name: 'ta', display: 'தமிழ்' },
      'te': { name: 'te', display: 'తెలుగు' },
      'ur': { name: 'ur', display: 'اردو' },
      'km': { name: 'km', display: 'ខ្មែរ' },
      'lo': { name: 'lo', display: 'ລາວ' },
      'my': { name: 'my', display: 'မြန်မာ' },
      'bg': { name: 'bg', display: 'Български' },
      'ca': { name: 'ca', display: 'Català' },
      'hr': { name: 'hr', display: 'Hrvatski' },
      'is': { name: 'is', display: 'Íslenska' },
      'lv': { name: 'lv', display: 'Latviešu' },
      'lt': { name: 'lt', display: 'Lietuvių' },
      'ro': { name: 'ro', display: 'Română' },
      'sk': { name: 'sk', display: 'Slovenčina' },
      'sl': { name: 'sl', display: 'Slovenščina' },
      'sr': { name: 'sr', display: 'Српски' },
      'uk': { name: 'uk', display: 'Українська' },
      cs: { name: 'cs', display: 'Čeština' },
      el: { name: 'el', display: 'Ελληνικά' },
      hu: { name: 'hu', display: 'Magyar' },
      da: { name: 'da', display: 'Dansk' },
      fi: { name: 'fi', display: 'Suomi' },
      nb: { name: 'nb', display: 'Norsk Bokmål' },
      sv: { name: 'sv', display: 'Svenska' }
    },
    LANGUAGES: {
      "ar": "Arabic",
      "bg": "Bulgarian",
      "bn": "Bengali",
      "ca": "Catalan",
      "cs": "Czech",
      "da": "Danish",
      "de": "German",
      "el": "Greek",
      "en": "English",
      "es": "Spanish",
      "et": "Estonian",
      "fa": "Farsi",
      "fi": "Finnish",
      "fr": "French",
      "gu": "Gujarati",
      "he": "Hebrew",
      "hi": "Hindi",
      "hr": "Croatian",
      "hu": "Hungarian",
      "id": "Indonesian",
      "it": "Italian",
      "ja": "Japanese",
      "kn": "Kannada",
      "ko": "Korean",
      "lt": "Lithuanian",
      "lv": "Latvian",
      "ml": "Malayalam",
      "mr": "Marathi",
      "ms": "Malay",
      "nb": "Norwegian Bokmål",
      "nl": "Dutch",
      "pl": "Polish",
      "pt": "Portuguese",
      "ro": "Romanian",
      "ru": "Russian",
      "sk": "Slovak",
      "sl": "Slovenian",
      "sr": "Serbian",
      "sv": "Swedish",
      "sw": "Swahili",
      "ta": "Tamil",
      "te": "Telugu",
      "th": "Thai",
      "tl": "Tagalog",
      "tr": "Turkish",
      "uk": "Ukrainian",
      "ur": "Urdu",
      "zh": "Chinese (Simplified)",
      "zh-TW": "Chinese (Traditional)"
    },
    OCR: {
      generation: {
        temperature: 0.6,
        topP: 0.8,
        topK: 30
      },
      maxFileSize: 2 * 1024 * 1024 * 1024,
      supportedFormats: [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/heic",
        "image/heif"
      ]
    },
    MEDIA: {
      generation: {
        temperature: 0.6,
        topP: 0.8,
        topK: 30
      },
      audio: {
        maxSize: 2 * 1024 * 1024 * 1024,
        supportedFormats: [
          "audio/wav",
          "audio/mp3",
          "audio/ogg",
          "audio/m4a",
          "audio/aac",
          "audio/flac",
          "audio/wma",
          "audio/opus",
          "audio/amr",
          "audio/midi",
          "audio/mpa"
        ]
      },
      video: {
        maxSize: 2 * 1024 * 1024 * 1024,
        supportedFormats: [
          "video/mp4",
          "video/webm",
          "video/ogg",
          "video/x-msvideo",
          "video/quicktime",
          "video/x-ms-wmv",
          "video/x-flv",
          "video/3gpp",
          "video/3gpp2",
          "video/x-matroska"
        ]
      }
    },
    VIDEO_STREAMING: {
      enabled: true,
      supportedSites: [
        'youtube.com',
        'udemy.com',
        // 'netflix.com',
        // 'coursera.org',
      ],
      styles: {
        subtitleContainer: {
          position: 'absolute',
          bottom: '2%',
          left: '50%',
          transform: 'translateX(-50%)',
          textAlign: 'center',
          zIndex: 2147483647,
          padding: '5px 10px',
          borderRadius: '5px',
          backgroundColor: 'rgba(0,0,0,0.7)',
          color: 'white',
          fontSize: 'clamp(1rem, 1.5cqw, 2.5rem)',
          fontFamily: "'GoMono Nerd Font', 'Noto Sans', Arial",
          textShadow: '2px 2px 2px rgba(0,0,0,0.5)',
          maxWidth: '90%'
        }
      }
    },
    contextMenu: {
      enabled: true
    },
    pageTranslation: {
      enabled: true,
      autoTranslate: false,
      showInitialButton: false, // Show initial translate button
      buttonTimeout: 10000, // Button display time (10 seconds)
      enableGoogleTranslate: false, // Default off
      googleTranslateLayout: 'INLINE', // "SIMPLE", "INLINE", "OVERLAY"
      useCustomSelectors: false,
      customSelectors: [],
      defaultSelectors: [
        "script",
        "code",
        "style",
        "input",
        "button",
        "textarea",
        ".notranslate",
        ".translator-settings-container",
        ".translator-tools-container",
        ".translator-content",
        ".draggable",
        ".page-translate-button",
        ".translator-tools-dropdown",
        ".translator-notification",
        ".translator-content",
        ".translator-context-menu",
        ".translator-overlay",
        ".translator-guide",
        ".center-translate-status",
        ".no-translate",
        "[data-notranslate]",
        "[translate='no']",
        ".html5-player-chrome",
        ".html5-video-player"
      ],
      generation: {
        temperature: 0.6,
        topP: 0.8,
        topK: 30
      }
    },
    promptSettings: {
      enabled: true,
      customPrompts: {
        normal: "",
        advanced: "",
        chinese: "",
        ocr: "",
        media: "",
        page: "",
        file_content: "",
        normal_chinese: "",
        advanced_chinese: "",
        chinese_chinese: "",
        ocr_chinese: "",
        media_chinese: "",
        page_chinese: "",
        file_content_chinese: ""
      },
      useCustom: false
    },
    CACHE: {
      text: {
        maxSize: 100, // Max 100 entries for text
        expirationTime: 5 * 60 * 1000, // 5 minutes
      },
      image: {
        maxSize: 100, // Max 100 entries for image
        expirationTime: 30 * 60 * 1000, // 30 minutes
      },
      media: {
        maxSize: 50, // Max 50 media entries
        expirationTime: 30 * 60 * 1000, // 30 minutes
      },
      tts: {
        maxSize: 100, // Max 100 audio files
        expirationTime: 30 * 60 * 1000, // 30 minutes
      }
    },
    RATE_LIMIT: {
      maxRequests: 5,
      perMilliseconds: 10000
    },
    THEME: {
      mode: "dark",
      light: {
        background: "#cccccc",
        backgroundShadow: "rgba(255, 255, 255, 0.05)",
        text: "#333333",
        border: "#bbb",
        title: "#202020",
        content: "#555",
        button: {
          close: { background: "#ff4444", text: "#ddd" },
          translate: { background: "#007BFF", text: "#ddd" }
        }
      },
      dark: {
        background: "#333333",
        backgroundShadow: "rgba(0, 0, 0, 0.05)",
        text: "#cccccc",
        border: "#555",
        title: "#eeeeee",
        content: "#bbb",
        button: {
          close: { background: "#aa2222", text: "#ddd" },
          translate: { background: "#004a99", text: "#ddd" }
        }
      }
    },
    STYLES: {
      translation: {
        marginTop: "10px",
        padding: "10px",
        backgroundColor: "#f0f0f0",
        borderLeft: "3px solid #4CAF50",
        borderRadius: "8px",
        color: "#333",
        position: "relative",
        fontFamily: "'GoMono Nerd Font', 'Noto Sans', Arial",
        fontSize: "16px",
        zIndex: "2147483647"
      },
      popup: {
        position: "fixed",
        border: "1px solid",
        padding: "20px",
        zIndex: "2147483647",
        maxWidth: "90vw",
        minWidth: "300px",
        maxHeight: "80vh",
        boxShadow: "0 0 10px rgba(0, 0, 0, 0.1)",
        borderRadius: "15px",
        fontFamily: "'GoMono Nerd Font', 'Noto Sans', Arial",
        fontSize: "16px",
        top: `${window.innerHeight / 2}px`,
        left: `${window.innerWidth / 2}px`,
        transform: "translate(-50%, -50%)",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto"
      },
      button: {
        position: "fixed",
        border: "none",
        borderRadius: "8px",
        padding: "5px 10px",
        cursor: "pointer",
        zIndex: "2147483647",
        fontSize: "14px"
      },
      dragHandle: {
        padding: "10px",
        borderBottom: "1px solid",
        cursor: "move",
        userSelect: "none",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        borderTopLeftRadius: "15px",
        borderTopRightRadius: "15px",
        zIndex: "2147483647"
      }
    }
  };
  const DEFAULT_SETTINGS = {
    uiLanguage: "en", // default UI language
    theme: CONFIG.THEME.mode,
    apiProvider: CONFIG.API.currentProvider,
    apiKey: {
      gemini: [""],
      perplexity: [""],
      claude: [""],
      openai: [""],
      mistral: [""]
    },
    currentKeyIndex: {
      gemini: 0,
      perplexity: 0,
      claude: 0,
      openai: 0,
      mistral: 0
    },
    geminiOptions: {
      modelType: "fast", // 'fast', 'pro', 'think', 'custom'
      fastModel: "gemini-2.0-flash-lite",
      proModel: "gemini-2.0-pro-exp-02-05",
      thinkModel: "gemini-2.0-flash-thinking-exp-01-21",
      customModel: ""
    },
    perplexityOptions: {
      modelType: "fast", // 'fast', 'balance', 'pro', 'custom'
      fastModel: "sonar",
      balanceModel: "sonar-deep-research",
      proModel: "sonar-pro",
      customModel: ""
    },
    claudeOptions: {
      modelType: "balance", // 'fast', 'balance', 'pro', 'custom'
      fastModel: "claude-3-5-haiku-latest",
      balanceModel: "claude-3-7-sonnet-latest",
      proModel: "claude-3-opus-latest",
      customModel: ""
    },
    openaiOptions: {
      modelType: "fast", // 'fast', 'balance', 'pro', 'custom'
      fastModel: "gpt-4.1-nano",
      balanceModel: "gpt-4.1",
      proModel: "o1-pro",
      customModel: ""
    },
    mistralOptions: {
      modelType: "free", // 'free', 'research', 'premier', 'custom'
      freeModel: "mistral-small-latest",
      researchModel: "open-mistral-nemo",
      premierModel: "codestral-latest",
      customModel: "",
    },
    ollamaOptions: {
      endpoint: "http://localhost:11434",
      model: "llama3",
    },
    contextMenu: {
      enabled: true
    },
    promptSettings: {
      enabled: true,
      customPrompts: {
        normal: "",
        advanced: "",
        chinese: "",
        ocr: "",
        media: "",
        page: "",
        file_content: "",
        normal_chinese: "",
        advanced_chinese: "",
        chinese_chinese: "",
        ocr_chinese: "",
        media_chinese: "",
        page_chinese: "",
        file_content_chinese: ""
      },
      useCustom: false
    },
    inputTranslation: {
      enabled: false,
      savePosition: true,
      excludeSelectors: []
    },
    translatorTools: {
      enabled: true
    },
    pageTranslation: {
      enabled: true,
      autoTranslate: false,
      showInitialButton: false,
      buttonTimeout: 10000,
      enableGoogleTranslate: false,
      googleTranslateLayout: 'INLINE',
      useCustomSelectors: false,
      customSelectors: [],
      defaultSelectors: CONFIG.pageTranslation.defaultSelectors,
      generation: {
        temperature: 0.6,
        topP: 0.8,
        topK: 30
      }
    },
    ocrOptions: {
      enabled: true,
      mangaTranslateAll: true,
      preferredProvider: CONFIG.API.currentProvider,
      maxFileSize: CONFIG.OCR.maxFileSize,
      temperature: CONFIG.OCR.generation.temperature,
      topP: CONFIG.OCR.generation.topP,
      topK: CONFIG.OCR.generation.topK
    },
    mediaOptions: {
      enabled: true,
      temperature: CONFIG.MEDIA.generation.temperature,
      topP: CONFIG.MEDIA.generation.topP,
      topK: CONFIG.MEDIA.generation.topK,
      audio: {
        processingInterval: 2000, // 2 seconds
        bufferSize: 16384,
        format: {
          sampleRate: 44100,
          numChannels: 1,
          bitsPerSample: 16
        }
      }
    },
    videoStreamingOptions: {
      enabled: false,
      fontSize: 'clamp(1rem, 1.5cqw, 2.5rem)',
      backgroundColor: 'rgba(0,0,0,0.7)',
      textColor: 'white'
    },
    displayOptions: {
      fontSize: "1rem",
      minPopupWidth: "300px",
      maxPopupWidth: "90vw",
      webImageTranslation: {
        fontSize: "auto",
        minFontSize: "8px",
        maxFontSize: "24px"
      },
      translationMode: "translation_only",
      sourceLanguage: "auto",
      targetLanguage: "en",
      languageLearning: {
        showSource: true
      }
    },
    ttsOptions: {
      enabled: true,
      defaultProvider: 'google',
      defaultGeminiModel: 'gemini-2.5-flash-preview-tts',
      defaultModel: 'tts-1',
      defaultSpeed: 1.0,
      defaultPitch: 1.0,
      defaultVolume: 1.0,
      defaultVoice: {
        gemini: { voice: 'Leda' },
        openai: { voice: 'sage' },
        google: {
          en: { name: 'en-US-Standard-A', display: 'US Female 1 - Standard' },
          zh: { name: 'cmn-CN-Standard-A', display: 'CN Female 1 - Standard' },
          ja: { name: 'ja-JP-Standard-A', display: 'JP Female 1 - Standard' },
          ko: { name: 'ko-KR-Standard-A', display: 'KR Female 1 - Standard' },
        }
      }
    },
    shortcuts: {
      settingsEnabled: true,
      enabled: true,
      pageTranslate: { key: "f", altKey: true },
      inputTranslate: { key: "t", altKey: true },
      ocrRegion: { key: "z", altKey: true },
      ocrWebImage: { key: "x", altKey: true },
      ocrMangaWeb: { key: "c", altKey: true },
      quickTranslate: { key: "q", altKey: true },
      popupTranslate: { key: "e", altKey: true },
      advancedTranslate: { key: "a", altKey: true }
    },
    clickOptions: {
      enabled: true,
      singleClick: { translateType: "popup" },
      doubleClick: { translateType: "quick" },
      hold: { translateType: "advanced" }
    },
    touchOptions: {
      enabled: true,
      sensitivity: 100,
      twoFingers: { translateType: "popup" },
      threeFingers: { translateType: "advanced" },
      fourFingers: { translateType: "quick" }
    },
    cacheOptions: {
      text: {
        enabled: true,
        maxSize: CONFIG.CACHE.text.maxSize,
        expirationTime: CONFIG.CACHE.text.expirationTime
      },
      image: {
        enabled: true,
        maxSize: CONFIG.CACHE.image.maxSize,
        expirationTime: CONFIG.CACHE.image.expirationTime
      },
      media: {
        enabled: true,
        maxSize: CONFIG.CACHE.media.maxSize,
        expirationTime: CONFIG.CACHE.media.expirationTime
      },
      tts: {
        enabled: true,
        maxSize: CONFIG.CACHE.tts.maxSize,
        expirationTime: CONFIG.CACHE.tts.expirationTime
      }
    },
    rateLimit: {
      maxRequests: CONFIG.RATE_LIMIT.maxRequests,
      perMilliseconds: CONFIG.RATE_LIMIT.perMilliseconds
    }
  };
