import os
import requests
import cloudinary
import cloudinary.api

# --- CONFIGURATION ---
cloudinary.config(
    cloud_name = "krishnakathamritam",
    api_key = "483386296379532",
    api_secret = "VYgmqtuCrk9doKHptvRCOv0I2pk",
    secure = True
)

# Local folder where you want to save everything
DOWNLOAD_FOLDER = "Cloudinary_Backups"
if not os.path.exists(DOWNLOAD_FOLDER):
    os.makedirs(DOWNLOAD_FOLDER)

def download_file(url, filename):
    """Helper function to download a file from a URL"""
    response = requests.get(url, stream=True)
    if response.status_code == 200:
        with open(os.path.join(DOWNLOAD_FOLDER, filename), 'wb') as f:
            for chunk in response.iter_content(1024):
                f.write(chunk)
        print(f"Successfully downloaded: {filename}")
    else:
        print(f"Failed to download: {filename}")

# --- CONFIGURATION ---
TRANSCRIPTION_SERVICE = "azure_video_indexer" # Options: "google_speech", "azure_video_indexer"
SUBTITLE_FORMAT = "srt"                 # Options: "vtt", "srt" (Note: Web players prefer VTT)

# Set a specific public_id to process only that video. 
# Set to None to process ALL videos.
TARGET_VIDEO_ID = None 

# ... (Cloudinary config remains) ...

def get_audio_and_transcripts():
    print("Fetching file list from Cloudinary...")
    
    # 1. Get resources
    if TARGET_VIDEO_ID:
        resources_list = [{'public_id': TARGET_VIDEO_ID, 'format': 'mp4', 'secure_url': ''}] 
        print(f"Targeting single video: {TARGET_VIDEO_ID}")
    else:
        # Fetch actual videos from account
        resources = cloudinary.api.resources(resource_type="video", max_results=500) 
        resources_list = resources.get('resources', [])
        if not resources_list:
            print("No videos found in account!")
            return
        print(f"Found {len(resources_list)} videos. Processing ALL of them.")
    
    # Counter to track successful triggers
    trigger_count = 0
    BATCH_LIMIT = 20

    for asset in resources_list:
        if trigger_count >= BATCH_LIMIT:
            print(f"\nBatch limit of {BATCH_LIMIT} reached. Please run again later for the next batch.")
            break

        public_id = asset['public_id']
        format = asset.get('format', 'mp4') 
        
        # Define filenames
        audio_filename = f"{public_id.replace('/', '_')}.{format}"
        transcript_filename = f"{public_id.replace('/', '_')}.{SUBTITLE_FORMAT}"
        
        # 2. Download Audio (Skipped)
        print(f"\nProcessing: {public_id}")
        
        # 2a. Trigger Transcription & Tagging
        try:
            print(f"Triggering transcription & tagging via {TRANSCRIPTION_SERVICE}...")
            
            response = cloudinary.api.update(
                public_id, 
                resource_type="video", 
                categorization="azure_video_indexer",
                auto_tagging=0.6,
                raw_convert="azure_video_indexer"
            )
            print("Update trigger sent.")
            trigger_count += 1
            
        except Exception as e:
            error_msg = str(e)
            if "420" in error_msg:
                print("\nError 420: Rate limit exceeded (limit is ~30 pending requests). Stopping now.")
                break
            else:
                print(f"Trigger failed (might already exist or error): {e}")

        # 3. Try to get the Transcript (Raw file)
        # Skipped for now as it takes time to generate. 
        # You can uncomment this or run a separate pass to download ready transcripts.
        """
        transcript_raw_public_id = f"{public_id}.{SUBTITLE_FORMAT}"
        try:
            # We explicitly look for the raw resource
            transcript_asset = cloudinary.api.resource(transcript_raw_public_id, resource_type="raw")
            transcript_url = transcript_asset['secure_url']
            print(f"Found transcript: {transcript_url}")
            download_file(transcript_url, transcript_filename)
        except Exception as e:
            # print(f"Transcript not ready yet...")
            pass
        """

if __name__ == "__main__":
    get_audio_and_transcripts()