export const resizeAndCompressImage = (file, maxWidth, maxHeight, quality) => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

                let width = img.width;
                let height = img.height;

                // Calcula novas dimensões mantendo a proporção para caber dentro de maxWidth/maxHeight
                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width *= maxHeight / height;
                        height = maxHeight;
                    }
                }

                // Ajusta o canvas para o tamanho exato desejado e centraliza a imagem
                canvas.width = maxWidth;
                canvas.height = maxHeight;

                // Preenche o fundo com branco (ou outra cor, se preferir)
                ctx.fillStyle = "#fff";
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                // Centraliza a imagem no canvas
                const x = (maxWidth - width) / 2;
                const y = (maxHeight - height) / 2;
                ctx.drawImage(img, x, y, width, height);

                canvas.toBlob((blob) => {
                    resolve(new File([blob], file.name, {
                        type: 'image/jpeg', // Sempre exporta como JPEG para melhor compressão
                        lastModified: Date.now()
                    }));
                }, 'image/jpeg', quality); // Qualidade JPEG
            };
        };
        reader.onerror = error => resolve(file); // Em caso de erro, retorna o arquivo original
    });
};