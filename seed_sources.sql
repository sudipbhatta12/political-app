-- Seed Data for Political Parties and News Media
-- Run this AFTER running supabase_schema_extension.sql

-- Insert Political Parties
INSERT INTO political_parties (name_en, name_np, abbreviation, website_url, facebook_url, is_active) VALUES
('Nepali Congress', 'नेपाली कांग्रेस', 'NC', 'https://nepalicongress.org', 'https://www.facebook.com/khatranepalicongress', true),
('CPN (UML)', 'नेकपा (एमाले)', 'UML', 'https://cpnuml.org', 'https://www.facebook.com/cpnuml', true),
('CPN (Maoist Centre)', 'नेकपा (माओवादी केन्द्र)', 'Maoist Centre', 'https://cpnmaoist.org', 'https://www.facebook.com/cpnmaoist', true),
('Rastriya Swatantra Party', 'राष्ट्रिय स्वतन्त्र पार्टी', 'RSP', 'https://rspnepal.org', 'https://www.facebook.com/rspnepal', true),
('Rastriya Prajatantra Party', 'राष्ट्रिय प्रजातन्त्र पार्टी', 'RPP', 'https://rpp.org.np', 'https://www.facebook.com/rppnepal', true),
('CPN (Unified Socialist)', 'नेकपा (एकीकृत समाजवादी)', 'CPN-US', 'https://cpnus.org', 'https://www.facebook.com/cpnus', true),
('Janata Samajbadi Party', 'जनता समाजवादी पार्टी', 'JSP', 'https://jspnepal.org', 'https://www.facebook.com/jspnepal', true),
('Loktantrik Samajbadi Party', 'लोकतान्त्रिक समाजवादी पार्टी', 'LSP', 'https://lspnepal.org', 'https://www.facebook.com/lspnepal', true),
('Nagarik Unmukti Party', 'नागरिक उन्मुक्ति पार्टी', 'NUP', NULL, 'https://www.facebook.com/nagarikunmukti', true),
('Janamat Party', 'जनमत पार्टी', 'Janamat', 'https://janamatparty.org', 'https://www.facebook.com/janamatparty', true);

-- Insert News Media
INSERT INTO news_media (name_en, name_np, website_url, facebook_url, twitter_url, youtube_url, is_active) VALUES
('Kantipur Daily', 'कान्तिपुर दैनिक', 'https://ekantipur.com', 'https://www.facebook.com/ekantipur', 'https://twitter.com/ekantipur_com', 'https://www.youtube.com/user/kantipur', true),
('OnlineKhabar', 'अनलाइनखबर', 'https://www.onlinekhabar.com', 'https://www.facebook.com/onlinekhabarnews', 'https://twitter.com/OnlineKhabar', 'https://www.youtube.com/c/onlinekhabarnepal', true),
('Setopati', 'सेतोपाटी', 'https://www.setopati.com', 'https://www.facebook.com/setopati', 'https://twitter.com/setopati', 'https://www.youtube.com/c/SetopatiNepal', true),
('The Kathmandu Post', 'काठमाण्डौ पोस्ट', 'https://kathmandupost.com', 'https://www.facebook.com/kathmandupost', 'https://twitter.com/kathmandupost', NULL, true),
('Nagarik News', 'नागरिक न्युज', 'https://nagariknews.nagariknetwork.com', 'https://www.facebook.com/nagariknews', 'https://twitter.com/nagarik_news', NULL, true),
('Annapurna Post', 'अन्नपूर्ण पोस्ट', 'https://annapurnapost.com', 'https://www.facebook.com/AnnapurnaPost', 'https://twitter.com/Annapurna_Post', NULL, true),
('Ratopati', 'रातोपाटी', 'https://ratopati.com', 'https://www.facebook.com/ratopati', 'https://twitter.com/ratopati', 'https://www.youtube.com/c/RatopatiTV', true),
('The Himalayan Times', 'द हिमालयन टाइम्स', 'https://thehimalayantimes.com', 'https://www.facebook.com/TheHimalayanTimesOnline', 'https://twitter.com/thehimalayan', NULL, true),
('Republica', 'रिपब्लिका', 'https://myrepublica.nagariknetwork.com', 'https://www.facebook.com/myrepublica', 'https://twitter.com/RepublicaNepal', NULL, true),
('Ujyaalo Online', 'उज्यालो अनलाइन', 'https://ujyaaloonline.com', 'https://www.facebook.com/UjyaaloOnline', 'https://twitter.com/Ujyaalo', 'https://www.youtube.com/user/UjyaaloNetwork', true),
('BBC Nepali', 'बीबीसी नेपाली', 'https://www.bbc.com/nepali', 'https://www.facebook.com/bbcnepali', 'https://twitter.com/bbcnepali', 'https://www.youtube.com/user/bbcnepali', true);
