import { parseDocumentToXML } from './htmlParserHelper';

function parseDocument(doc, goal) {//source：来源网址 goal:需要提取到的目标
    const xml = parseDocumentToXML(doc);
    return xml; // 返回解析结果
}

function parseUrl(url, goal) {
    // URL解析逻辑
}

export {
    parseDocument,
    parseUrl
};

