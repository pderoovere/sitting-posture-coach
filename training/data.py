import os
import shutil
import glob
import psycopg2
import pandas as pd
import boto3
import cv2
import mediapipe as mp
import numpy as np
import imageio
from dotenv import dotenv_values


config = dotenv_values('.env')


def download_data():
    connection = psycopg2.connect(f"dbname='{config['DB_DATABASE']}' user='{config['DB_USER']}' host='{config['DB_HOST']}' password='{config['DB_PASSWORD']}' port='{config['DB_PORT']}'")
    cursor = connection.cursor()

    cursor.execute("""SELECT * from examples""")
    rows = cursor.fetchall()

    for row in rows:
        print(row)

    data = pd.DataFrame(rows, columns =['session', 'timestamp', 'client', 'image_url', 'image_index', 'mode', 'score', 'uuid'])
    data.to_pickle('data.p')

    # remove output folders and make new
    if not os.path.exists('data'):
        os.mkdir('data')
    if os.path.exists('data/raw'):
        shutil.rmtree('data/raw')
    if os.path.exists('data/images'):
        shutil.rmtree('data/images')
    os.mkdir('data/raw')
    os.mkdir('data/images')

    s3 = boto3.client('s3') # set your ~/.aws/config file
    for url in data.image_url:
        name = url.split('/')[-1]
        path = f'data/raw/{name}'
        if not os.path.exists(path):
            s3.download_file('sitting-posture-bucket', name, path)
            print(f'Downloaded {path}')

    paths = os.listdir('data/raw')
    for path in paths:
        input_path = 'data/raw/' + path
        output_path = 'data/images/' + path + '.jpg'

        image = imageio.imread(input_path)
        imageio.imwrite(output_path, image[..., :3])


def preprocess_image(path):
    with mp.solutions.face_detection.FaceDetection(min_detection_confidence=0.5) as face_detection:
        image = imageio.imread(path)
        results = face_detection.process(image)
        if not results.detections:
            return None
        # take the first face
        face = results.detections[0].location_data.relative_bounding_box

        x = face.xmin * image.shape[1]
        y = face.ymin * image.shape[0]
        w = face.width * image.shape[1]
        h = face.height * image.shape[0]

        center = np.array([x + w / 2, y + h])
        r = int(np.sqrt(w * h)) * 2

        image_padded = np.pad(image, ((r, r), (r, r), (0, 0)))

        x0, y0 = (center - r + r).astype(int)
        x1, y1 = (center + r + r).astype(int)
        crop = image_padded[y0:y1, x0:x1, :]
        output = cv2.resize(crop, (128, 128))
    return output


def preprocess_dataset():
    score_to_label = {
        0: 0,
        1: 1,
        2: 0,
    }

    # remove output folders and make new
    if os.path.exists('data/train'):
        shutil.rmtree('data/train')
    if os.path.exists('data/val'):
        shutil.rmtree('data/val')
    os.mkdir('data/train')
    os.mkdir('data/val')
    for c in set(score_to_label.values()):
        os.mkdir(f'data/train/{c}')
        os.mkdir(f'data/val/{c}')

    data = pd.read_pickle('data.p')
    data = data[28:] # start of valid data
    # these id's are used as validation set (they're all the same person, who is now not present in the training set)
    validation_idxs = [28, 29, 30, 31, 32, 33, 34, 35, 36, 39, 40, 41, 42, 43, 44]
    print(data)

    for i, row in data.iterrows():
        input_path = 'data/images/' + row['image_url'].split('/')[-1] + '.jpg'
        image = preprocess_image(input_path)
        if image is None:
            print(f"No face detected: {row['image_url']}")
            continue
        
        label = score_to_label[row['score']]
        if i in validation_idxs:
            output_path = 'data/val/' + str(label) + '/' + row['image_url'].split('/')[-1] + '.jpg'
        else:
            output_path = 'data/train/' + str(label) + '/' + row['image_url'].split('/')[-1] + '.jpg'
        imageio.imwrite(output_path, image)


if __name__ == '__main__':
    download_data()
    preprocess_dataset()
