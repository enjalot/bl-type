import numpy as np
import cv2
from PIL import Image

def process_image(src):
 im=Image.open(src).convert('RGB'); rgb=np.array(im); gray=cv2.cvtColor(rgb,cv2.COLOR_RGB2GRAY)
 # Normalize paper luminance while preserving the entire source tile, including ornament.
 bg=float(np.percentile(gray,90)); normalized=np.clip(gray.astype(float)*255/max(bg,1),0,255).astype('uint8')
 threshold,mask=cv2.threshold(normalized,0,255,cv2.THRESH_BINARY_INV+cv2.THRESH_OTSU)
 contours,_=cv2.findContours(mask,cv2.RETR_LIST,cv2.CHAIN_APPROX_SIMPLE)
 paths=[]
 for contour in contours:
  if cv2.contourArea(contour)<1.5:continue
  p=cv2.approxPolyDP(contour,0.45,True).reshape(-1,2)
  if len(p)<3:continue
  paths.append('M'+'L'.join(f'{x},{y}' for x,y in p)+'Z')
 path=''.join(paths); w,h=im.size
 # Rotation-independent texture / tone statistics, not an OCR or font classifier.
 dark=mask>0; n=max(1,int(dark.sum())); areas=sorted([cv2.contourArea(c)/(w*h) for c in contours],reverse=True)
 border=np.r_[dark[:max(1,h//8)].ravel(),dark[-max(1,h//8):].ravel(),dark[:,:max(1,w//8)].ravel(),dark[:,-max(1,w//8):].ravel()]
 f=[w/h,dark.mean(),border.mean(),len(contours)/100, sum(cv2.arcLength(c,True) for c in contours)/(w*h),*(areas[:3]+[0]*3)[:3],*np.mean(rgb,axis=(0,1))/255,*np.std(rgb,axis=(0,1))/128]
 clean=Image.fromarray(np.dstack([np.full_like(normalized,25)]*3+[255-normalized]),'RGBA')
 return src,im,clean,path,f,float(threshold)

