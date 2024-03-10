import React, { useRef, useState } from 'react';

interface RecordButtonProps {
	onRecordingComplete: (audioBlob: Blob) => void;
}

const RecordButton: React.FC<RecordButtonProps> = ({ onRecordingComplete }) => {
	const [isRecording, setIsRecording] = useState(false);
	const mediaRecorder = useRef<MediaRecorder>();
	const [chunks, setChunks] = useState<Blob[]>([]);

	const handleButtonClick = () => {
		if (isRecording) {
			stopRecording();
		} else {
			startRecording();
		}
	};

	const startRecording = () => {
		setIsRecording(true);
		navigator.mediaDevices
			.getUserMedia({ audio: true })
			.then((stream) => {
				const recorder = new MediaRecorder(stream);
				mediaRecorder.current = recorder;
				mediaRecorder.current.start();

				const localAudioChunks: Blob[] = [];
				mediaRecorder.current.ondataavailable = (event) => {
					if (typeof event.data === 'undefined') return;
					if (event.data.size === 0) return;
					localAudioChunks.push(event.data);
				};
				setChunks(localAudioChunks);
			})
			.catch((error) => {
				console.error('Error accessing microphone:', error);
			});
	};

	const stopRecording = () => {
		if (mediaRecorder.current) {
			mediaRecorder.current.stop();
			setIsRecording(false);

			mediaRecorder.current.onstop = () => {
				const audioBlob = new Blob(chunks, { type: 'audio/webm' });
				onRecordingComplete(audioBlob);
				setChunks([]);
			};
			mediaRecorder.current = undefined;
		}
	};

	return (
		<button onClick={handleButtonClick}>
			{isRecording ? 'Stop' : 'Start Recording'}
		</button>
	);
};

export default RecordButton;
