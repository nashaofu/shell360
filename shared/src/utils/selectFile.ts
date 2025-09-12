export function selectFile() {
  const $input = document.createElement('input');
  $input.setAttribute('type', 'file');

  return new Promise<File[]>((resolve) => {
    $input.addEventListener('change', () => {
      const files = $input.files || [];
      resolve([...files]);
    });
    $input.click();
  });
}
